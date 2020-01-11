import express from 'express';
import * as bodyParser from 'body-parser';

import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as firebaseHelper from 'firebase-functions-helper';
import serviceAccount from './serviceAccountKey.json';

import dayjs from 'dayjs';
import uuidv1 from 'uuid/v1';
import { filesUpload } from './middleware';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as any),
  databaseURL: serviceAccount['database_url']
});

const db = admin.firestore();
const bucket = admin.storage().bucket('gs://deliveryorder-b9b84.appspot.com');
const app = express();
const main = express();

main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
main.use('/api/v1', app);

const TimeZoneTaipei = () => dayjs().add(8, 'hour');
const formatTemplate = 'YYYY-MM-DD HH:mm:ss';
const licensesCollection = 'licenses';

export const webApi = functions.https.onRequest(main);

// Activate a license
app.patch('/activation/:license', (req, res) => {
  const { license } = req.params;
  const { email } = req.body;

  return firebaseHelper.firestore
    .checkDocumentExists(db, licensesCollection, license)
    .then(result => {
      const notExists = !result.exists;
      const doc = result.data || {};
      const emails = doc.emails || [];
      const matchEmail = emails.indexOf(email) >= 0;
      const hasTokenMatchEmail = () => doc.token && matchEmail;
      const noTokenMatchEmail = () => !doc.token && matchEmail;

      if (notExists) {
        console.log(`license: ${license} is not exist`);
        res.send({ message: `${license} is not correct` });
      } else if (hasTokenMatchEmail()) {
        res.send({ data: doc.token });
      } else if (noTokenMatchEmail()) {
        generateToken();
      } else {
        console.log(`Activate error license: ${license}, email:${email}`);
        res.send({ message: `${license} activated already` });
      }

      function generateToken() {
        const token = uuidv1();
        console.log(`Activate from Ip:${req.connection.remoteAddress} Token:${token}`);
        firebaseHelper.firestore
          .updateDocument(db, licensesCollection, license, { token });
        res.send({ data: token });
      }
    });
})

// Authorization
app.post('/authorization', (req, res) => {
  const { license, token } = req.body;

  return firebaseHelper.firestore
    .checkDocumentExists(db, licensesCollection, license)
    .then(result => {
      if (!result.exists) {
        res.send({ message: `${license} 無效`, data: [] });
      } else {
        const { data } = result;

        if (token != data.token) {
          console.log(`Authorization is token error, Ip:${req.connection.remoteAddress} Info:${JSON.stringify(data)}`);
          console.log(`Req body: ${JSON.stringify(req.body)}`);
          res.send({ message: `${license} 尚未驗證`, data: [] });
        } else {
          const currentTime = TimeZoneTaipei();
          const expiredAt = dayjs(data.expiredAt);
          if (currentTime.isBefore(expiredAt)) {
            res.send({ data: data.authorizations });
          } else {
            console.log(`Authorization is expired, Ip:${req.connection.remoteAddress} Info:${JSON.stringify(data)}`);
            console.log(`Req body: ${JSON.stringify(req.body)}`);
            res.send({ message: `${license} 已過期`, data: [] });
          }
        }
      }
    });
})

// Get server time
app.get('/time/taipei', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  return res.status(200)
    .send({ data: TimeZoneTaipei().format(formatTemplate) });
})

// Post upload image
app.post('/image/upload', filesUpload, (req, res, next) => {
  const [file] = req['files'];

  let fileUpload = bucket.file(file.originalname);
  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype
    }
  });
  blobStream.on('error', (error) => {
    res.send({
      success: false,
      error,
    })
  });

  blobStream.on('finish', () => {
    // The public URL can be used to directly access the file via HTTP.
    fileUpload.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60000 * 60 * 24 * 365 * 5, // 5 years
    }, (err, url) => {
      res.send({
        success: true,
        url,
      });
    });
  });

  blobStream.end(file.buffer);
});