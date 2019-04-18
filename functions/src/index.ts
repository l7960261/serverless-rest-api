import * as bodyParser from "body-parser";
import express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as firebaseHelper from 'firebase-functions-helper';
import serviceAccount from './serviceAccountKey.json';
import dayjs from 'dayjs'

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

const formatTemplate = 'YYYY-MM-DD HH:mm:ss';
const licensesCollection = 'licenses';

export const webApi = functions.https.onRequest(main);

// Add new license
app.post('/licenses', (req, res) => {
    var data = Object.assign({}, req.body);
    data.createdAt = dayjs().add(8, 'hour').format(formatTemplate);
    data.expiredAt = dayjs(data.createdAt).add(30, 'day').format(formatTemplate);

    firebaseHelper.firestore
        .createNewDocument(db, licensesCollection, data)
    res.send('Create a new license');
})

// Update new license
app.patch('/licenses/:licenseId', (req, res) => {
    firebaseHelper.firestore
        .updateDocument(db, licensesCollection, req.params.licenseId, req.body);
    res.send('Update a new license');
})

// View a license
app.get('/licenses/:licenseId', (req, res) => {
    firebaseHelper.firestore
        .getDocument(db, licensesCollection, req.params.licenseId)
        .then(doc => res.status(200).send(doc));
})

// View all licenses
app.get('/licenses', (req, res) => {
    firebaseHelper.firestore
        .backup(db, licensesCollection)
        .then(data => res.status(200).send(data))
})

// Delete a license 
app.delete('/licenses/:licenseId', (req, res) => {
    firebaseHelper.firestore
        .deleteDocument(db, licensesCollection, req.params.licenseId);
    res.send('License is deleted');
})
