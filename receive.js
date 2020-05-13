"use strict"

// Todo generate invoice ninja api key on VM and switch keys
// Todo fill in mailtrap.io information and point to phantomjs
// Todo change external ip to internal ip
// Todo put messages everywhere
// Todo generate new IN token
// Todo make global constants like the api url's and invoice-ninja token
// Todo refactor where possible
// Todo Add relevant XSD files and import them
// Todo come up with a way to get an invoice for an entire event
// Todo Insert heartbeat into this file


// Imports
const amqp = require('amqplib/callback_api');
const axios = require("axios").default;
const fs = require("fs");
const libxmljs = require("libxmljs");
const xmlParser = require("xml2json");
//const assert = require("assert");

// Load XSD files
const addUserFile = fs.readFileSync("./XSD/addUser.xsd");
const patchUserFile = fs.readFileSync("./XSD/patchUser.xsd");
const addInvoiceFile = fs.readFileSync("./XSD/addInvoice.xsd");
const emailInvoiceFile = fs.readFileSync("./XSD/emailInvoice.xsd");
const emailEventFile = fs.readFileSync("./XSD/emailEvent.xsd");

// Parse the files into xml
const addUserDoc = libxmljs.parseXml(addUserFile);
const patchUserDoc = libxmljs.parseXml(patchUserFile);
const addInvoiceDoc = libxmljs.parseXml(addInvoiceFile);
const emailInvoiceDoc = libxmljs.parseXml(emailInvoiceFile);
const emailEventDoc = libxmljs.parseXml(emailEventFile);

// Global variables
let currentChannel;
let standardUserToSendEventInfo = {
    name: "IntegrationProject",
    email: "invoiceninja@integrationproject.be",
    street: "Nijverheidskaai 170",
    postalCode: 1070,
    municipal: "Anderlecht",
    vat: "123456789"
}
const INToken = "clzjfmtlwcmzjl3l328epk2hkezxj013";
const INApiUrl = "http://localhost/projects/ninja/public/api/v1/";
const rabbitMQIP = "10.3.50.9";
const axiosConfig = {
    headers: {
        "X-Ninja-Token": `${INToken}`
    }
}



// Connect to the service
amqp.connect(`amqp://facturatie_user:facturatie_pwd@${rabbitMQIP}`, function(error0, connection) {
    if(error0){
        console.log("Connection error");
        console.log(error0);
    }
    // Connect to the right channel
    connection.createChannel(function(error1, channel){
        if(error1){
            console.log("Create channel error");
            console.error(error1);
        }
        // Declare the queue you want to listen to
        let queue = "facturatie.queue"

        /*channel.assertQueue(queue, {
            durable: true
        });*/

        console.log(`Waiting for messages in ${queue}. Exit with CTR+C`);

        channel.consume(queue, function(msg) {
            currentChannel = channel;
            console.log(`Received message:  ${msg.content.toString()}`);
            // Todo find a way to deal with ack
            let allowRemoveFromQueue = false;

            try{
                let messageXML = libxmljs.parseXmlString(msg.content);
                handleCases(messageXML, channel);
            }
            catch(error){
                console.log("Unable to handle message");
                allowRemoveFromQueue = true;
                sendMessage(error.toString(), true);
            }



            // Error handling if needed

            // If everything went well, acknowledge the message to remove it from the queue
            console.log(`Ready to Ack ${msg.content.toString()}`);
            if(allowRemoveFromQueue){
                console.log("Acknowledging the message.");
                //channel.ack(msg);
            }


            // Todo remove noAck below if everything is working
        }, {
            noAck: false
        });
    });
});

async function handleCases(messageXML, channel){
    // Check what kind of event is being sent
    // Which we can determine by checking the name of the root element

    switch(messageXML.root().name()){
        case "add_user":
            console.log("Adding a new user");
            // Validation
            if(messageXML.validate(addUserDoc)){
                // Valid XML
                // Extract all the data from the XML message
                //uuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat
                let uuid = messageXML.get("//uuid").text();
                let name = messageXML.get("//name").text();
                let email = messageXML.get("//email").text();
                let street = messageXML.get("//street").text();
                let municipal = messageXML.get("//municipal").text();
                let postalCode = messageXML.get("//postalCode").text();
                let vat = messageXML.get("//vat").text();
                let eventId = messageXML.get("//event_id").text();
                await newINUser(uuid, name, email, street, municipal, postalCode, vat, eventId);

            }
            else{
                // Invalid XML
                sendMessage("XML for new user could not be validated", true);
            }
            break;
        case "patch_user":
            console.log("Patching user");
            // Validation
            if(messageXML.validate(patchUserDoc)){
                // Valid XML
                // Extract all the data from the XML message
                let uuid = messageXML.get("//uuid").text();
                let name = messageXML.get("//name").text();
                let email = messageXML.get("//email").text();
                let street = messageXML.get("//street").text();
                let municipal = messageXML.get("//municipal").text();
                let postalCode = messageXML.get("//postalCode").text();
                let vat = messageXML.get("//vat").text();
                let eventId = messageXML.get("//event_id").text();
                await updateINUser(uuid, name, email, street, municipal, postalCode, vat, eventId);

            }
            else{
                // Invalid XML
                sendMessage( "XML to patch user could not be validated", true);
            }
            break;
        case "add_invoice":
            console.log("Adding a new invoice");
            // Validation
            if(messageXML.validate(addInvoiceDoc)){
                // Valid XML

                let messageJson = JSON.parse(xmlParser.toJson(messageXML.toString()));
                console.table(messageJson);
                await addInvoice(messageJson);
            }
            else{
                // Invalid XML
                sendMessage( "XML to create invoice could not be validated", true);
            }
            break;
        case "email_invoice":
            console.log("Sending invoice by email");
            // validation
            if(messageXML.validate(emailInvoiceDoc)){
                // Valid XML
                let uuid = messageXML.get("//uuid").text();
                try{
                    await INSendInvoiceMail(uuid);
                }
                catch(error){
                    sendMessage("Unable to send email for this invoice", true);
                }
            }
            else{
                sendMessage("XML to email invoice could not be validated", true);
            }
            break;
        case "email_event":
            console.log("Sending invoice for the entire event");
            // validation
            if(messageXML.validate(emailEventDoc)){
                // Valid XML
                let eventId = messageXML.get("//event_id").text();
                try{
                    await INSendEventMail(eventId);
                }
                catch(error){
                    sendMessage("Unable to send email for this event", true);
                }
            }
            else{
                sendMessage("XML to create email for this event could not be validated", true);
            }
            break;
        default:
            sendMessage( "Unknown case", true);
    }
}

async function addInvoice(invoiceModel){
    try{
        let appIdResponse = await getAppIdFromUuid(invoiceModel.uuid);
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            // Determine if we have to create a new invoice, or update one that exists already
            let clientResponse = await INGetClient(appId);
            let client = clientResponse.data.data;
            //console.log("Client: ");
            //console.log(client);
            let invoicesExist = client.invoices.length > 0 ? true : false;
            if(invoicesExist){
                // Update invoice
                let invoiceNumber = client.invoices[0].id;

                try{
                    let updateResponse = await INPatchInvoice(invoiceNumber, invoiceModel);
                    console.log("Update Response: ");
                    console.log(updateResponse);
                }
                catch(error){
                    console.log("Failed to update invoice");
                }
            }
            else{
                // Create new invoice
                try {
                    let updateResponse = await INPostNewInvoice(client.id, invoiceModel);
                    console.log(updateResponse);
                    console.log("Update Response: ");
                    console.log(updateResponse);
                }
                catch(error){
                    //console.log(error);
                    console.log("Failed to create invoice");
                }
            }
            // todo send message to log exchange
        }
        catch(error){
            console.log(error);
            console.log("Failure to add or update invoice");
        }
    }
    catch(error){
        console.log("Error when getting app id from uuid");
        //console.log(error);
    }
}

async function newINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat, pPrivateNotes){
    console.log("Posting the following data to invoiceninja: ");
    console.log(pUuid, pName, pEmail, pMunicipal, pStreet, pPostalCode, pVat);
    // Post to IN
    try{
        let newClientResponse = await INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail, pPrivateNotes);
        let appId = newClientResponse.data.data.id;
        console.log(`Patching user in masterUUID with uuid: ${pUuid} and appId: ${appId}`);
        // Patch Master UUID
        try{
            await patchUserUUID(pUuid, appId);
            console.log("patchUserUUID succesfull")
        }
        catch(error){
            console.log("patchUserUUID failure")
        }
    }
    catch(error){
        console.log("Error when posting new client to IN");
    }
}

async function updateINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat, pPrivateNotes){
    console.log("Updating IN user");
    try{
        let appIdResponse = await getAppIdFromUuid(pUuid);
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            let updateClientResponse = await INPatchClient(appId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail, pPrivateNotes);
            // todo send message to log exchange
        }
        catch(error){
            console.log(error);
            console.log("Failure to patch IN user");
        }
    }
    catch(error){
        console.log("Error when getting app id from uuid");
        //console.log(error);
    }
}

async function patchUserUUID(pUuid, applicationId){
    return await axios.patch(`http://10.3.50.9/uuid-master/uuids/${pUuid}`,
        {"facturatie":`${applicationId}`}
    );
}

async function getAppIdFromUuid(pUuid) {
    return await axios.get(`http://10.3.50.9/uuid-master/uuids/${pUuid}`);
}

async function INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail, pPrivateNotes){
    return await axios.post(`${INApiUrl}clients`, {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
        vat_number: pVat,
        private_notes: pPrivateNotes,
        contact:{
            last_name: pName,
            email: pEmail
        }
    }, axiosConfig);
}

async function INPatchClient(pAppId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail, pPrivateNotes){
    return await axios.put(`${INApiUrl}clients/${pAppId}`, {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
        private_notes: pPrivateNotes,
        vat_number: pVat,
        contact:{
            last_name: pName,
            email: pEmail
        }
    }, axiosConfig);
}


async function INGetClient(pAppId){
    return await axios.get(`${INApiUrl}clients/${pAppId}?include=invoices`, axiosConfig);
}

async function INSendMail(invoiceId){
    return await axios.post(`${INApiUrl}email_invoice`, {
        "id": `${invoiceId}`,
    },axiosConfig);
}

async function INGetInvoice(invoiceId){
    return await axios.get(`${INApiUrl}invoices/${invoiceId}`, axiosConfig);
}

async function INGetAllClientsAndInvoices(){
    return await axios.get(`${INApiUrl}clients?include=invoices`, axiosConfig);
}

async function INPostNewInvoice(clientId, invoiceModel, comesFromXML){
    console.log("new invoice");
    // create the object
    let payload = {
        "client_id": `${clientId}`,
        "invoice_items": [],
        "paid": parseFloat(invoiceModel.add_invoice.paid),
    }
    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items, comesFromXML);
    return await axios.post(`${INApiUrl}invoices`, payload, axiosConfig);
}

async function INPatchInvoice(invoiceNumber, invoiceModel){
    // create the object
    let payload = {
        "invoice_items": [],
        "paid": parseFloat(invoiceModel.add_invoice.paid),
    }
    // Get original invoice data
    let originalInvoice = await INGetInvoice(invoiceNumber);
    console.log("original invoice: ");
    console.log(originalInvoice);
    console.log("data1");
    console.log(originalInvoice.data);
    console.log("data2");
    console.log(originalInvoice.data.data);
    // Add old items back to the invoice
    payload.invoice_items = createInvoicePayload(originalInvoice.data.data.invoice_items, payload.invoice_items, false);
    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items, true);
    return await axios.put(`${INApiUrl}invoices/${invoiceNumber}`,
        payload,
        {
            headers: {
                "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
            }
        }
    )
}

function createInvoicePayload(orderLines, existingItems, comesFromXML){
    // comesFromXML has different names for the data, so we have to differentiate
    let result = existingItems.length > 0 ? existingItems : [];
    for(let line of orderLines){
        //console.log("New line");
        //console.log(line);
        result.push(
            {
                "product_key": comesFromXML ? line.name : line.product_key,
                "notes": comesFromXML ? line.description : line.notes,
                "cost": comesFromXML ? line.price : line.cost,
                "qty": comesFromXML ? line.quantity : line.qty,
            }
        );
    }
    //console.log(result);
    return result;
}

async function INSendInvoiceMail(uuid){
    // todo magic numbers removal
    try{
        let appIdResponse = await getAppIdFromUuid(uuid);
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            // Get user and his invoices
            let clientWithInvoice = await INGetClient(appId);
            console.log(clientWithInvoice);
            let invoiceId = clientWithInvoice.data.data.invoices[0].id;
            console.log("Invoice id: ");
            console.log(invoiceId);
            try{
                let response = await INSendMail(invoiceId);
                console.log(response.data);
            }
            catch(error){
                console.log("Couldn't send email");
            }
        }
        catch(error){
            console.log("error retrieving client to send an email to");
        }
    }
    catch(error) {
        console.log("Error when getting app id from uuid");
        //console.log(error);
    }
}

async function INSendEventMail(eventId){
    // Get all clients and their invoices
    try{
        let allClientsResponse = await INGetAllClientsAndInvoices();
        let allClients = allClientsResponse.data.data;
        // Filter clients that have the eventId as private_notes
        let filteredClients = [];
        for(let client of allClients){
            if(client.private_notes === eventId){
                filteredClients.push(client);
            }
        }
        if(filteredClients.length > 0){
            // Combine all the info from their invoices and store it
            let combinedInvoiceItems = [];
            let alreadyPaid = 0;
            for(let client of filteredClients){
                // todo add already paid info
                let tempInvoiceItems = createInvoicePayload(client.invoices[0].invoice_items, [], false);
                combinedInvoiceItems.push(...tempInvoiceItems);
            }
            // Create new client from template
            try{
                let newClientResponse = await INPostNewClient(standardUserToSendEventInfo.name, standardUserToSendEventInfo.street, standardUserToSendEventInfo.postalCode, standardUserToSendEventInfo.municipal, standardUserToSendEventInfo.vat, standardUserToSendEventInfo.email, "");
                let newclientId = newClientResponse.data.data.id;
                // Create new invoice from the stored data
                let invoiceModel = {
                    add_invoice: {
                        paid: alreadyPaid,
                        order_line: combinedInvoiceItems
                    }
                }
                let newInvoiceResponse = await INPostNewInvoice(newclientId, invoiceModel, false);
                console.log(newInvoiceResponse);
                let newInvoiceId = newInvoiceResponse.data.data.id;
                console.log("Invoice id: ");
                console.log(newInvoiceId);
                // Send the invoice by mail
                try{
                    let sentEmailResponse = await INSendEventMail(newInvoiceId);
                    console.log(sentEmailResponse.data);
                }
                catch(error){
                }
            }
            catch(error){

            }
        }
        else{
            sendMessage("No clients with eventID found", true);
        }
    }
    catch(error){
        sendMessage(error.toString(), true);
    }
}

function sendMessage(message, isError){
    let messageType = !isError ? "log" : "error";
    let enhancedMessage = `<?xml version="1.0" encoding="utf-8"?>
            <${messageType}>
                <application_name>facturatie</application_name>
                <timestamp>${new Date().toISOString()}</timestamp>
                <message>${message}</message>
            </${messageType}>`;
    let queueName = `${messageType}s.exchange`;
    currentChannel.assertQueue(queueName, {
        durable:false
    });
    currentChannel.sendToQueue(queueName, Buffer.from(enhancedMessage));
    console.log(`${enhancedMessage} sent to ${queueName}`);
}
