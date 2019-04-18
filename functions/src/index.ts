import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import * as firebaseHelper from 'firebase-functions-helper';
import express from 'express';
import * as bodyParser from "body-parser";
import serviceAccount from './serviceAccountKey.json';

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

const contactsCollection = 'contacts';

export const webApi = functions.https.onRequest(main);


// Add new contact
app.post('/contacts', (req, res) => {
    firebaseHelper.firestore
        .createNewDocument(db, contactsCollection, req.body)
        .then(docRef => console.log(docRef.id));
    res.send('Create a new contact');
})

// Update new contact
app.patch('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .updateDocument(db, contactsCollection, req.params.contactId, req.body);
    res.send('Update a new contact');
})

// View a contact
app.get('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .getDocument(db, contactsCollection, req.params.contactId)
        .then(doc => res.status(200).send(doc));
})

// View all contacts
app.get('/contacts', (req, res) => {
    firebaseHelper.firestore
        .backup(db, contactsCollection)
        .then(data => res.status(200).send(data))
})

// Delete a contact 
app.delete('/contacts/:contactId', (req, res) => {
    firebaseHelper.firestore
        .deleteDocument(db, contactsCollection, req.params.contactId);
    res.send('Contact is deleted');
})
