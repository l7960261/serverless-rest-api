import * as bodyParser from "body-parser";
import express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as firebaseHelper from 'firebase-functions-helper';
import serviceAccount from './serviceAccountKey.json';
import dayjs from 'dayjs';
import uuidv1 from 'uuid/v1';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    databaseURL: serviceAccount['database_url']
});

const db = admin.firestore();
const app = express();
const main = express();

main.use('/api/v1', app);
main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));

const TimeZoneTaipei = () => dayjs().add(8, 'hour');
const formatTemplate = 'YYYY-MM-DD HH:mm:ss';
const licensesCollection = 'licenses';

export const webApi = functions.https.onRequest(main);

// Add new license
// app.post('/licenses', (req, res) => {
//     var data = Object.assign({}, req.body);
//     data.createdAt = TimeZoneTaipei().format(formatTemplate);
//     data.expiredAt = dayjs(data.createdAt).add(30, 'day').format(formatTemplate);

//     firebaseHelper.firestore
//         .createNewDocument(db, licensesCollection, data)
//     return res.send('Create a new license');
// })

// Update new license
// app.patch('/licenses/:licenseId', (req, res) => {
//     firebaseHelper.firestore
//         .updateDocument(db, licensesCollection, req.params.licenseId, req.body);
//     return res.send('Update a new license');
// })

// View a license
// app.get('/licenses/:licenseId', (req, res) => {
//     return firebaseHelper.firestore
//         .getDocument(db, licensesCollection, req.params.licenseId)
//         .then(doc => res.status(200).send(doc));
// })

// View all licenses
// app.get('/licenses', (req, res) => {
//     return firebaseHelper.firestore
//         .backup(db, licensesCollection)
//         .then(data => res.status(200).send(data))
// })

// Delete a license 
// app.delete('/licenses/:licenseId', (req, res) => {
//     firebaseHelper.firestore
//         .deleteDocument(db, licensesCollection, req.params.licenseId);
//     return res.send('License is deleted');
// })

// Activate a license
app.patch('/activation/:licenseId', (req, res) => {
    const licenseId = req.params.licenseId;
    const email = req.body.email;

    return firebaseHelper.firestore
        .checkDocumentExists(db, licensesCollection, licenseId)
        .then(result => {
            const notExists = !result.exists;
            const doc = result.data || {};
            const emails = doc.emails || [];
            const matchEmail = emails.indexOf(email) >= 0;
            const hasTokenButIsRegular = () => doc.token && doc.regular;
            const hasTokenMatchEmail = () => doc.token && matchEmail;
            const noTokenButIsRegular = () => !doc.token && doc.regular;
            const noTokenMatchEmail = () => !doc.token && matchEmail;

            if (notExists) {
                console.log(`licenseId: ${licenseId} is not exist`);
                res.send({ message: `${licenseId} is not correct` });
            } else if (hasTokenButIsRegular()
                || hasTokenMatchEmail()) {
                res.send({ data: doc.token });
            } else if (noTokenButIsRegular()
                || noTokenMatchEmail()) {
                generateToken();
            } else {
                console.log(`Activate error licenseId: ${licenseId}, email:${email}`);
                res.send({ message: `${licenseId} activated already` });
            }

            function generateToken() {
                const token = uuidv1();
                console.log(`Activate from Ip:${req.connection.remoteAddress} Token:${token}`);
                firebaseHelper.firestore
                    .updateDocument(db, licensesCollection, licenseId, { token });
                res.send({ data: token });
            }
        });
})

// Authorization
app.post('/authorization', (req, res) => {
    const licenseId = req.body.license;
    const token = req.body.token;

    return firebaseHelper.firestore
        .checkDocumentExists(db, licensesCollection, licenseId)
        .then(result => {
            if (!result.exists) {
                res.send({ message: `${licenseId} 無效`, data: [] });
            } else {
                const data = result.data;

                if (data.regular) {
                    console.log(`Authorization is regular, Ip:${req.connection.remoteAddress}`);
                    console.log(`Req body: ${JSON.stringify(req.body)}`);
                    res.send({ data: data.authorizations });
                } else if (token != data.token) {
                    console.log(`Authorization is token error, Ip:${req.connection.remoteAddress} Info:${JSON.stringify(data)}`);
                    console.log(`Req body: ${JSON.stringify(req.body)}`);
                    res.send({ message: `${licenseId} 尚未驗證`, data: [] });
                } else {
                    const currentTime = TimeZoneTaipei();
                    const expiredAt = dayjs(data.expiredAt);
                    if (currentTime.isBefore(expiredAt)) {
                        res.send({ data: data.authorizations });
                    } else {
                        console.log(`Authorization is expired, Ip:${req.connection.remoteAddress} Info:${JSON.stringify(data)}`);
                        console.log(`Req body: ${JSON.stringify(req.body)}`);
                        res.send({ message: `${licenseId} 已過期`, data: [] });
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