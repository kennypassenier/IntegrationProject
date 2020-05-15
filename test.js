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
    let allClients = await INGetAllClientsAndInvoices();
    //console.log(allClients);
    console.log(allClients.data.data);
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
/*

    // Patch user
    user.name = "updated";
    user.email = "update@email.be";
    user.vat = "987654321";
    console.log("Update user 1");
    await updateINUser("e203909d-6a4f-4efd-9901-8bac4b6a9ec7", user.name, user.email, user.street, user.municipal, user.postalCode, user.vat, user.privateNotes);
    console.log("");


    // Create invoice
    let invoiceTest = "<add_invoice><application_name>kassa</application_name><uuid>e203909d-6a4f-4efd-9901-8bac4b6a9ec7</uuid><event_id>event 1</event_id><paid>0</paid><invoice_date>05-05-2020</invoice_date><order_line><name>[DISC] Discount</name><quantity>2.0</quantity><price>0.0</price><discount>0.0</discount></order_line><order_line><name>[TIPS] Tips</name><quantity>2.0</quantity><price>1.0</price><discount>0.0</discount></order_line></add_invoice>";
    let invoiceXML = libxmljs.parseXmlString(invoiceTest);
    //console.log(invoiceXML.toString());
    //console.log("Valid?");
    //console.log(invoiceXML.validate(addInvoiceDoc));
    // Transform xml to json
    let messageJson = JSON.parse(xmlParser.toJson(invoiceXML.toString()));
    console.table(messageJson);
    console.log(messageJson);
    for(let line of messageJson.add_invoice.order_line){
        console.log(line);
    }
    let addedInvoice = await addInvoice(messageJson);
    console.log(addedInvoice);

    // Email invoice
    await INSendInvoiceMail("e203909d-6a4f-4efd-9901-8bac4b6a9ec7");

    // email for event
    let eventMail = await INSendEventMail("eventNumber");
    console.log(eventMail);
*/



}






async function INSendEventMail(eventId){
    console.log(eventId);
    // Get all clients and their invoices

    try{
        let allClientsResponse = await INGetAllClientsAndInvoices();
        let allClients = allClientsResponse.data.data;
        // Filter clients that have the eventId as private_notes
        let filteredClients = [];

        let counter = 0;
        for(let client of allClients){
            console.log(counter++);
            console.log(client.private_notes);
            console.log(eventId);
            if(client.private_notes === eventId){
                filteredClients.push(client);
            }
        }
        if(filteredClients.length > 0){
            console.log("length > 0");
            // Combine all the info from their invoices and store it
            let combinedInvoiceItems = [];
            let alreadyPaid = 0;
            for(let client of filteredClients){
                if(client.invoices.length > 0){
                    console.log(client.invoices[0].invoice_items);
                    // todo add already paid info

                    /*
                    let tempInvoiceItems = createInvoicePayload(tempInvoiceItemsTest, [], false);
                    console.log(tempInvoiceItems);
                    combinedInvoiceItems.push(...tempInvoiceItems);
                    }*/
                    // todo refactor
                    for(let invoice_item of client.invoices[0].invoice_items) {
                        combinedInvoiceItems.push(
                            {
                                "product_key": invoice_item.product_key,
                                "notes": invoice_item.notes,
                                "cost": invoice_item.cost,
                                "qty": invoice_item.qty,
                            }
                        );
                    }
                    console.log("comb items length");
                    console.log(combinedInvoiceItems.length);
                    console.table(combinedInvoiceItems);
                }
                else{
                    console.log("No invoices");
                }

            }
            // Create new client from template
            try{
                let newClientResponse = await INPostNewClient(standardUserToSendEventInfo.name, standardUserToSendEventInfo.street, standardUserToSendEventInfo.postalCode, standardUserToSendEventInfo.municipal, standardUserToSendEventInfo.vat, standardUserToSendEventInfo.email, "");
                let newclientId = newClientResponse.data.data.id;
                console.log("new client id");
                console.log(newclientId);
                // Create new invoice from the stored data

                let invoiceModel = {
                    add_invoice: {
                        paid: alreadyPaid,
                        order_line: combinedInvoiceItems
                    }
                }
                //console.log(invoiceModel);
                console.log("INPOSTNEWINVOICE: ");
                console.log(newclientId);
                console.log(invoiceModel);
                let newInvoiceResponse = await INPostNewInvoice(newclientId, invoiceModel, false);
                console.log("NEWINVOICERESPONSE");
                console.log(newInvoiceResponse.data);
                let newInvoiceId = newInvoiceResponse.data.data.id;
                console.log("Invoice id: ");
                console.log(newInvoiceId);
                // Send the invoice by mail
                try{
                    let sentEmailResponse = await INSendMail(newInvoiceId);
                    console.log(sentEmailResponse.data);
                }
                catch(error){
                    console.log("can't send mail");
                }
            /*
             */
            }
            catch(error){
                console.log("can't post new client");
            }

        }
        else{
            console.log("No clients with eventID found");
        }
    }
    catch(error){
        console.log(error.toString());
    }
}
















async function INGetAllClientsAndInvoices(){
    return await axios.get(`${INApiUrl}clients?include=invoices`, axiosConfig);
}

// Patch invoice

// Mail invoice

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
    return await axios.post("http://localhost/projects/ninja/public/api/v1/clients", {
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

    }, {
        headers: {
            "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
        }
    });
}

async function INPatchClient(pAppId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail, pPrivateNotes){
    return await axios.put(`http://localhost/projects/ninja/public/api/v1/clients/${pAppId}`, {
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

    }, {
        headers: {
            "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
        }
    });
}

async function INGetClient(pAppId){
    return await axios.get(`http://localhost/projects/ninja/public/api/v1/clients/${pAppId}?include=invoices`, {
        headers: {
            "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
        }
    });
}

async function INSendMail(invoiceId){
    return await axios.post(`http://localhost/projects/ninja/public/api/v1/email_invoice`, {
        "id": `${invoiceId}`,
    },{
        headers: {
            "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
        }
    });
}

async function INGetInvoice(invoiceId){
    return await axios.get(`http://localhost/projects/ninja/public/api/v1/invoices/${invoiceId}`, {
        headers: {
            "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
        }
    });
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
    return await axios.post("http://localhost/projects/ninja/public/api/v1/invoices",
        payload,
        {
            headers: {
                "X-Ninja-Token": "clzjfmtlwcmzjl3l328epk2hkezxj013"
            }
        }
    );
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
    /*
    // todo refactor
    for(let line of originalInvoice.data.data.invoice_items){
        console.log("Old line: ");
        console.log(line);
        payload.invoice_items.push(
            {
                "product_key": line.product_key,
                "notes": line.notes,
                "cost": line.cost,
                "qty": line.qty,
            }
        );
    }
     */


    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items, true);

    console.log("payload: ");
    console.log(payload);
    console.table(payload);
    console.log(invoiceModel);

    return await axios.put(`http://localhost/projects/ninja/public/api/v1/invoices/${invoiceNumber}`,
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

