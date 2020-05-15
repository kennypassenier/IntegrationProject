"use strict"

// Todo generate invoice ninja api key on VM and switch keys
// Todo change external ip to internal ip

// Imports
const amqp = require('amqplib/callback_api');
const axios = require("axios").default;
const fs = require("fs");
const libxmljs = require("libxmljs");
//const assert = require("assert");
const xmlParser = require("xml2json");
// Load XSD files
const addUserFile = fs.readFileSync("./XSD/addUser.xsd");
const patchUserFile = fs.readFileSync("./XSD/patchUser.xsd");
const addInvoiceFile = fs.readFileSync("./XSD/addInvoice.xsd");
// Todo update invoice mss niet nodig
const updateInvoiceFile = fs.readFileSync("./XSD/updateInvoice.xsd");

// Parse the files into xml
const addUserDoc = libxmljs.parseXml(addUserFile);
const patchUserDoc = libxmljs.parseXml(patchUserFile);
const addInvoiceDoc = libxmljs.parseXml(addInvoiceFile);
// Todo update invoice mss niet nodig
const updateInvoiceDoc = libxmljs.parseXml(updateInvoiceFile);


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





startTest();

async function startTest(){
/*

// Create user
    let user = {
        name: "newUser",
        email: "new@email.be",
        street: "straatnaam 1",
        municipal: "stad",
        postalCode: "1000",
        vat: "123456789",
    }
    console.log("Creating user 1");
    let newUserRes = await newINUser("e203909d-6a4f-4efd-9901-8bac4b6a9ec7", user.name, user.email, user.street, user.municipal, user.postalCode, user.vat, user.privateNotes);
    console.log(newUserRes);
    console.log("");

    // Patch user
    user.name = "updated";
    user.email = "update@email.be";
    user.vat = "987654321";
    console.log("Update user 1");
    await updateINUser("e203909d-6a4f-4efd-9901-8bac4b6a9ec7", user.name, user.email, user.street, user.municipal, user.postalCode, user.vat, user.privateNotes);
    console.log("");


    // Create invoice
    let invoiceTest = "" +
        "<add_invoice>" +
            "<application_name>kassa</application_name>" +
            "<uuid>d7c9bdc0-daff-433f-ad40-ff28254210d2</uuid>" +
            "<event_id>20</event_id>" +
            "<paid>0</paid>" +
            "<invoice_date>05-05-2020</invoice_date>" +
            "<order_line>" +
                "<name>testnaam</name>" +
                "<quantity>25</quantity>" +
                "<price>70.0</price>" +
                "<discount>0.0</discount>" +
            "</order_line><order_line>" +
                "<name>testnaam2</name>" +
                "<quantity>200.0</quantity>" +
                "<price>159.0</price>" +
                "<discount>0.0</discount>" +
            "</order_line>" +
        "</add_invoice>";
    let invoiceXML = libxmljs.parseXmlString(invoiceTest);
    //console.log(invoiceXML.toString());
    //console.log("Valid?");
    //console.log(invoiceXML.validate(addInvoiceDoc));
    // Transform xml to json
    let messageJson = JSON.parse(xmlParser.toJson(invoiceXML.toString()));
    //console.table(messageJson);
    //console.log(messageJson);
    for(let line of messageJson.add_invoice.order_line){
        console.log(line);
    }
    let addedInvoice = await addInvoice(messageJson);
    console.log(addedInvoice);
*/

    // Email invoice
    //await INSendInvoiceMail("d7c9bdc0-daff-433f-ad40-ff28254210d2");

    // email for event
    let eventMail = await INSendEventMail("20");
    console.log(eventMail);
    /*


     */


}




async function handleCases(messageXML, channel, msg){
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
                        channel.ack(msg);
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
                        channel.ack(msg);
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
        console.log(`InvoiceModel:`);
        console.log(invoiceModel);
        for(let line of invoiceModel.add_invoice.order_line){
            console.log(line);
        }
        let appIdResponse = await getAppIdFromUuid(invoiceModel.add_invoice.uuid);
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            // Determine if we have to create a new invoice, or update one that exists already
            let clientResponse = await INGetClient(appId);
            let client = clientResponse.data.data;
            let invoicesExist = client.invoices.length > 0;
            if(invoicesExist){
                // Update invoice
                let invoiceNumber = client.invoices[0].id;
                console.log("Invoice already exists, here is the number: ");
                console.log(invoiceNumber);

                try{
                    console.log("Patching invoice");
                    console.log(`InvoiceNumber: ${invoiceNumber}`);
                    console.log("invoiceModel: ");
                    console.log(invoiceModel);
                    await INPatchInvoice(invoiceNumber, invoiceModel);
                    sendMessage("Invoice has been successfully updated.", false);
                }
                catch(error){
                    console.log("------------------------------");
                    //console.log(error);
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
            sendMessage("Unable to retrieve user", true);
        }
    }
    catch(error) {
        sendMessage("Unable to retrieve facturatie id", true);
    }
}

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
                "notes": " "
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
    console.log(`${enhancedMessage} sent to ${exchange}`);
    return;
    currentChannel.publish(exchange, "", Buffer.from(enhancedMessage));
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

    console.log("Payload before creating new invoice: ");
    console.log(payload);
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

    console.log("Creating test: ");


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
