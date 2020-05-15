"use strict"

// Todo generate invoice ninja api key on VM and switch keys
// Todo fill in mailtrap.io information and point to phantomjs
// Todo change external ip to internal ip
// Todo generate new IN token
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
// Local token
const INToken = "clzjfmtlwcmzjl3l328epk2hkezxj013";
// VM token
//const INToken = "xqi9nwol4tb8cilipgcvho8vl6b3cgha";
const INApiUrl = "http://localhost/projects/ninja/public/api/v1/";
// IP address for Jochen's VM
// Local IP
const rabbitMQIP = "10.3.50.9";
// IP from VM
// const rabbitMPIP = "192.168.1.2";
const axiosConfig = {
    headers: {
        "X-Ninja-Token": `${INToken}`
    }
}
let canSendWaitMessage = true;

connect();
function connect(){
    // Connect to the service
    amqp.connect(`amqp://facturatie_user:facturatie_pwd@${rabbitMQIP}`, function(error0, connection) {
        if(error0){
            console.log("Connection error");
            console.log(error0);
        }
        console.log("Connection established");
        // Connect to the right channel
        connection.createChannel(async function(error1, channel){
            if(error1){
                console.log("Create channel error");
                console.error(error1);
            }
            // Send heartbeats
            setInterval(function(){
                let exchange = 'heartbeats.exchange';
                let msg = currentHeartbeat();
                channel.publish(exchange, "", Buffer.from(msg));
                //console.log(` [x] Sent ${msg}`);
            }, 500);
            // Declare the queue you want to listen to
            let queue = "facturatie.queue";
            console.log(`Waiting for messages in ${queue}. Exit with CTRL+C`);
            consume(channel, queue);
        });
    });

}
function consume(channel, queue){
    channel.get(queue, { noAck: false }, async function(err, msg) {
        if(msg){
            canSendWaitMessage = true;
            currentChannel = channel;
            console.log("                                                  <--- Start of message --->");
            console.log(`Received message:  ${msg.content.toString()}`);
            try{
                let messageXML = libxmljs.parseXmlString(msg.content);
                await handleCases(messageXML);
            }
            catch(error){
                sendMessage("Unable to handle case", true);
            }
            console.log(`                                                  <--- End of message --->`);
            console.log();
            console.log();
            console.log();
            console.log();
            console.log();
        }
        if(canSendWaitMessage){
            console.log("Waiting for messages. Exit with CTRL+C");
            canSendWaitMessage = false;
        }

        consume(channel, queue);
        // Todo remove noAck below if everything is working
    });
}

async function handleCases(messageXML){
    // Check what kind of event is being sent
    // Which we can determine by checking the name of the root element

    switch(messageXML.root().name()){
        case "add_user":
            console.log("Adding a new user");
            // Validation
            if(messageXML.validate(addUserDoc)){
                // Valid XML
                try{
                    // Extract all the data from the XML message
                    let uuid = messageXML.get("//uuid").text();
                    let name = messageXML.get("//name").text();
                    let email = messageXML.get("//email").text();
                    let street = messageXML.get("//street").text();
                    let municipal = messageXML.get("//municipal").text();
                    let postalCode = messageXML.get("//postalCode").text();
                    let vat = messageXML.get("//vat").text();
                    try{
                        await newINUser(uuid, name, email, street, municipal, postalCode, vat);
                    }
                    catch(error){
                        sendMessage("Unable to create new user in Invoice Ninja.", true);
                    }
                }
                catch(error){
                    sendMessage("Unable to extract data from XML", true);
                }

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
                try{
                    // Extract all the data from the XML message
                    let uuid = messageXML.get("//uuid").text();
                    let name = messageXML.get("//name").text();
                    let email = messageXML.get("//email").text();
                    let street = messageXML.get("//street").text();
                    let municipal = messageXML.get("//municipal").text();
                    let postalCode = messageXML.get("//postalCode").text();
                    let vat = messageXML.get("//vat").text();
                    try{
                        await updateINUser(uuid, name, email, street, municipal, postalCode, vat);
                    }
                    catch(error){
                        sendMessage("Unable to update user in Invoice Ninja", true);
                    }
                }
                catch(error){
                    sendMessage("Unable to extract data from XML", true);
                }
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
                try{
                    // Turn XML into JSON, makes it easier to handle and we have already validated the payload at this point
                    let messageJson = JSON.parse(xmlParser.toJson(messageXML.toString()));
                    try{
                        await addInvoice(messageJson);
                    }
                    catch(error){
                        sendMessage("Unable to add new invoice to Invoice Ninja", true);
                    }
                }
                catch(error){
                    sendMessage("Unable to convert XML to JSON", true);
                }
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
                try{
                    let uuid = messageXML.get("//uuid").text();
                    try{
                        await INSendInvoiceMail(uuid);
                    }
                    catch(error){
                        sendMessage("Unable to send email for this invoice", true);
                    }
                }
                catch(error){
                    sendMessage("Unable to extract UUID from XML", true);
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
                try{
                    let eventId = messageXML.get("//event_id").text();
                    try{
                        await INSendEventMail(eventId);
                    }
                    catch(error){
                        sendMessage("Unable to send invoice email for this event", true);
                    }
                }
                catch(error){
                    sendMessage("Unable to extract event_id from XML", true);
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


// Functions that actually handle the cases

// Handles the add_user case
async function newINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){
    try{
        let newClientResponse = await INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail);
        let appId = newClientResponse.data.data.id;
        // Patch Master UUID
        try{
            await patchUserUUID(pUuid, appId);
            // Send log to indicate that task is complete
            sendMessage("New user has been successfully created.", false);
        }
        catch(error){
            sendMessage("Unable to patch user UUID", true);
        }
    }
    catch(error){
        sendMessage("Unable to post new client to Invoice Ninja", true);
    }
}

// Handles the patch_user case
async function updateINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){
    try{
        let appIdResponse = await getAppIdFromUuid(pUuid);
        let appId = appIdResponse.data.facturatie;
        try{
            await INPatchClient(appId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail);
            // Send log to indicate that task is complete
            sendMessage("User has been successfully updated.", false);
        }
        catch(error){
            sendMessage("Unable to patch user", true);
        }
    }
    catch(error){
        sendMessage("Unable to retrieve facturatie id", true);
    }
}

// Handles the add_invoice case
async function addInvoice(invoiceModel){
    try{
        let appIdResponse = await getAppIdFromUuid(invoiceModel.add_invoice.uuid);
        let appId = appIdResponse.data.facturatie;
        try{
            // Determine if we have to create a new invoice, or update one that exists already
            let clientResponse = await INGetClient(appId);
            let client = clientResponse.data.data;
            let invoicesExist = client.invoices.length > 0;
            if(invoicesExist){
                // Update invoice
                let invoiceNumber = client.invoices[0].id;
                try{
                    console.log("Patching invoice");
                    await INPatchInvoice(invoiceNumber, invoiceModel);
                    sendMessage("Invoice has been successfully updated.", false);
                }
                catch(error){
                    sendMessage("Unable to update invoice", true);
                }
            }
            else{
                // Create new invoice
                try {
                    console.log("Creating new invoice");
                    await INPostNewInvoice(client.id, invoiceModel, true);
                    sendMessage("Invoice has been successfully created.", false);
                }
                catch(error){
                    sendMessage("Unable to create invoice", true);
                }
            }
            // Send log to indicate that task is complete
        }
        catch(error){
            sendMessage("Unable to retrieve client", true);
        }
    }
    catch(error){
        sendMessage("Unable to retrieve facturatie id", true);
    }
}

// Handles the email_invoice case
async function INSendInvoiceMail(uuid){
    // todo magic numbers removal
    try{
        let appIdResponse = await getAppIdFromUuid(uuid);
        let appId = appIdResponse.data.facturatie;
        try{
            // Get user and his invoices
            let clientWithInvoice = await INGetClient(appId);
            try{
                let invoiceId = clientWithInvoice.data.data.invoices[0].id;
                try{
                    await INSendMail(invoiceId);
                    // Send log to indicate that task is complete
                    sendMessage("Invoice has been successfully sent via email.", false);
                }
                catch(error){
                    sendMessage("Unable to send email", true);
                }
            }
            catch(error){
                sendMessage("User does not have any invoices", true);
            }
        }
        catch(error){
            sendMessage("Unable to retrieve user", true);
        }
    }
    catch(error) {
        sendMessage("Unable to retrieve facturatie id", true);
    }
}

// Handles the email_event case
// Handles the email_event case
async function INSendEventMail(eventId){
    // Get all invoices
    try{
        let allInvoicesResponse = await INGetAllInvoices();
        let allInvoices = allInvoicesResponse.data.data;
        // Filter invoices that have the event_id as private notes
        let filteredInvoices = [];
        for(let invoice of allInvoices){
            if(invoice.private_notes === eventId){
                filteredInvoices.push(invoice);
            }
        }
        if(filteredInvoices.length > 0){
            // Combine all the info from these invoices and store them
            let combinedInvoiceItems = [];
            let alreadyPaid = 0;
            for(let inv of filteredInvoices){
                let paid = inv.amount - inv.balance;
                alreadyPaid += paid;
                let tempInvoiceItems = createInvoicePayload(inv.invoice_items, [], false);
                combinedInvoiceItems.push(...tempInvoiceItems);
            }
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
                let newInvoiceId = newInvoiceResponse.data.data.id;
                // Send the invoice by mail
                try{
                    await INSendMail(newInvoiceId);
                    // Send log to indicate that task is complete
                    sendMessage("Email with invoice for the entire event has been successfully sent by mail.")
                }
                catch(error){
                    sendMessage("Unable to send event invoice by mail", true);
                }
            }
            catch(error){
                sendMessage("Unable to retrieve user id", true);
            }
        }
        else{
            sendMessage("No invoices found that match the given event_id", true);
        }
    }
    catch(error){
        sendMessage("Unable to retrieve invoices", true);
    }
}

// Helper functions
function createInvoicePayload(orderLines, existingItems, comesFromXML){

    // Items that come out of XML have different names than the items coming from Invoice Ninja
    let result = existingItems.length > 0 ? existingItems : [];
    for(let line of orderLines){
        result.push(
            {
                "product_key": comesFromXML ? line.name : line.product_key,
                "cost": comesFromXML ? line.price : line.cost,
                "qty": comesFromXML ? line.quantity : line.qty,
                "notes": comesFromXML ? "" : line.notes,
            },
        );
    }
    return result;
}

function sendMessage(message, isError){
    let messageType = !isError ? "log" : "error";
    let enhancedMessage = `<?xml version="1.0" encoding="utf-8"?>
            <${messageType}>
                <application_name>facturatie</application_name>
                <timestamp>${new Date().toISOString()}</timestamp>
                <message>${message}</message>
            </${messageType}>`;
    let exchange = `${messageType}s.exchange`;
    currentChannel.publish(exchange, "", Buffer.from(enhancedMessage));
    console.log(`${enhancedMessage} sent to ${exchange}`);
}

function currentHeartbeat(){
    return `<?xml version="1.0" encoding="utf-8"?>
            <heartbeat>
                <application_name>facturatie</application_name>
                <timestamp>${new Date().toISOString()}</timestamp>
            </heartbeat>`;
}

// Functions that use API calls directly to Invoice Ninja
// GET
async function INGetClient(pAppId){
    return await axios.get(`${INApiUrl}clients/${pAppId}?include=invoices`, axiosConfig);
}

async function INGetInvoice(invoiceId){
    return await axios.get(`${INApiUrl}invoices/${invoiceId}`, axiosConfig);
}

/*
async function INGetAllClientsAndInvoices(){
    return await axios.get(`${INApiUrl}clients?include=invoices`, axiosConfig);
}
*/

async function INGetAllInvoices(){
    return await axios.get(`${INApiUrl}invoices`, axiosConfig);
}

// POST
async function INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail){
    return await axios.post(`${INApiUrl}clients`, {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
        vat_number: pVat,
        contact:{
            last_name: pName,
            email: pEmail
        }
    }, axiosConfig);
}

async function INSendMail(invoiceId){
    return await axios.post(`${INApiUrl}email_invoice`, {
        "id": `${invoiceId}`,
    },axiosConfig);
}

async function INPostNewInvoice(clientId, invoiceModel, comesFromXML){
    // create the object
    let payload = {
        "client_id": `${clientId}`,
        "invoice_items": [],
        "paid": parseFloat(invoiceModel.add_invoice.paid),
        "private_notes": invoiceModel.add_invoice.event_id,
    };
    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, [], comesFromXML);
    return await axios.post(`${INApiUrl}invoices`, payload, axiosConfig);
}


// PUT
async function INPatchClient(pAppId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail){
    return await axios.put(`${INApiUrl}clients/${pAppId}`, {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
        vat_number: pVat,
        contact:{
            last_name: pName,
            email: pEmail
        }
    }, axiosConfig);
}

async function INPatchInvoice(invoiceNumber, invoiceModel){
    // create the object
    let payload = {
        "invoice_items": [],
        "paid": parseFloat(invoiceModel.add_invoice.paid),
        "private_notes": invoiceModel.add_invoice.event_id,
    };
    // Get original invoice data
    let originalInvoice = await INGetInvoice(invoiceNumber);
    // Add old items back to the invoice
    payload.invoice_items = createInvoicePayload(originalInvoice.data.data.invoice_items, payload.invoice_items, false);
    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items, true);

    return await axios.put(`${INApiUrl}invoices/${invoiceNumber}`, payload, axiosConfig);
}

// Functions that call the Master UUID
// GET
async function getAppIdFromUuid(pUuid) {
    return await axios.get(`http://${rabbitMQIP}/uuid-master/uuids/${pUuid}`);
}

// PATCH
async function patchUserUUID(pUuid, applicationId){
    return await axios.patch(`http://${rabbitMQIP}/uuid-master/uuids/${pUuid}`,
        {"facturatie":`${applicationId}`}
    );
}