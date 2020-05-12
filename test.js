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








startTest();

async function startTest(){

// Create user
    let user = {
        name: "Kenny",
        email: "kenny@email.be",
        street: "straatnaam 1",
        municipal: "stad",
        postalCode: "1000",
        vat: "123456789"
    }
    console.log("Creating user 1");
    await newINUser("e203909d-6a4f-4efd-9901-8bac4b6a9ec7", user.name, user.email, user.street, user.municipal, user.postalCode, user.vat);
    console.log("");

    // Patch user
    user.name = "Bart";
    user.email = "bart@email.be";
    user.vat = "987654321";
    console.log("Update user 1");
    await updateINUser("e203909d-6a4f-4efd-9901-8bac4b6a9ec7", user.name, user.email, user.street, user.municipal, user.postalCode, user.vat);
    console.log("");


    // Create invoice
    let invoiceTest = "<add_invoice><application_name>kassa</application_name><uuid>e203909d-6a4f-4efd-9901-8bac4b6a9ec7</uuid><event_id>event 1</event_id><paid>0</paid><invoice_date>05-05-2020</invoice_date><order_line><name>[DISC] Discount</name><quantity>2.0</quantity><price>0.0</price><discount>0.0</discount></order_line><order_line><name>[TIPS] Tips</name><quantity>2.0</quantity><price>1.0</price><discount>0.0</discount></order_line></add_invoice>";
    let invoiceXML = libxmljs.parseXmlString(invoiceTest);
    console.log(invoiceXML.toString());
    console.log("Valid?");
    console.log(invoiceXML.validate(addInvoiceDoc));
    // Transform xml to json
    let messageJson = JSON.parse(xmlParser.toJson(invoiceXML.toString()));
    console.table(messageJson);
    await addInvoice(messageJson);

    // Email invoice
    await INSendInvoiceMail("e203909d-6a4f-4efd-9901-8bac4b6a9ec7");



}



// Patch invoice

// Mail invoice

async function addInvoice(invoiceModel){

    try{
        let appIdResponse = await getAppIdFromUuid("e203909d-6a4f-4efd-9901-8bac4b6a9ec7");
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            // Determine if we have to create a new invoice, or update one that exists already

            let clientResponse = await INGetClient(123);
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




async function newINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){

    console.log("Posting the following data to invoiceninja: ");
    console.log(pUuid, pName, pEmail, pMunicipal, pStreet, pPostalCode, pVat);

    // Post to IN
    try{
        let newClientResponse = await INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail);
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

async function updateINUser(pUuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){
    console.log("Updating IN user");
    try{
        let appIdResponse = await getAppIdFromUuid(pUuid);
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);
        try{
            let updateClientResponse = await INPatchClient(appId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail);
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
    console.log("Start patchUserUuid");
    return await axios.patch(`http://10.3.50.9/uuid-master/uuids/${pUuid}`,
        {"facturatie":`${applicationId}`}
    );
}

async function getAppIdFromUuid(pUuid) {
    console.log("start getAppIdFromUuid");
    return await axios.get(`http://10.3.50.9/uuid-master/uuids/${pUuid}`);

}

async function INPostNewClient(pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail){
    return await axios.post("http://localhost/projects/ninja/public/api/v1/clients", {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
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

async function INPatchClient(pAppId, pName, pStreet, pPostalCode, pMunicipal, pVat, pEmail){
    return await axios.put(`http://localhost/projects/ninja/public/api/v1/clients/${pAppId}`, {
        name: pName,
        address1: pStreet,
        postal_code: pPostalCode,
        city: pMunicipal,
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

async function INPostNewInvoice(clientId, invoiceModel){
    // create the object
    let payload = {
        "client_id": `${clientId}`,
        "invoice_items": [],
        "paid": parseFloat(invoiceModel.add_invoice.paid),
    }

    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items);

    console.log("payload: ");
    console.log(payload);
    console.table(payload);
    console.log(invoiceModel);

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


    // Enter new items
    payload.invoice_items = createInvoicePayload(invoiceModel.add_invoice.order_line, payload.invoice_items);

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

function createInvoicePayload(orderLines, existingItems){
    let result = existingItems.length > 0 ? existingItems : [];

    for(let line of orderLines){
        console.log("New line");
        console.log(line);
        result.push(
            {
                "product_key": line.name,
                "notes": line.discount,
                "cost": line.price,
                "qty": line.quantity,
            }
        );
    }
    return result;
}

async function INSendInvoiceMail(uuid){
    // todo magic numbers removal
    try{
        let appIdResponse = await getAppIdFromUuid("e203909d-6a4f-4efd-9901-8bac4b6a9ec7");
        let appId = appIdResponse.data.facturatie;
        console.log(`AppId: ${appId}`);

        try{
            // Get user and his invoices
            let clientWithInvoice = await INGetClient(123);
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

