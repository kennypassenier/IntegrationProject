"use strict"

// Todo generate invoice ninja api key on VM and switch keys
// Todo change external ip to internal ip

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
// Todo update invoice mss niet nodig
const updateInvoiceFile = fs.readFileSync("./XSD/updateInvoice.xsd");

// Parse the files into xml
const addUserDoc = libxmljs.parseXml(addUserFile);
const patchUserDoc = libxmljs.parseXml(patchUserFile);
const addInvoiceDoc = libxmljs.parseXml(addInvoiceFile);
// Todo update invoice mss niet nodig
const updateInvoiceDoc = libxmljs.parseXml(updateInvoiceFile);


//10.3.50.9
// Connect to the service
amqp.connect('amqp://facturatie_user:facturatie_pwd@10.3.50.9', function(error0, connection) {
    if(error0){
        console.log("Connection error");
        console.log(error0);
        throw error0;
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
            console.log(`Received message:  ${msg.content.toString()}`);
            let allowRemoveFromQueue = false;

            try{
                let messageXML = libxmljs.parseXmlString(msg.content);
                handleCases(messageXML, channel);
            }
            catch(e){
                console.log("Unable to handle message");
                allowRemoveFromQueue = true;
                sendError(channel, e.toString());
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
                newINUser(uuid, name, email, street, municipal, postalCode, vat);

            }
            else{
                // Invalid XML
                sendError(channel, "XML for new user could not be validated");
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
                updateINUser(uuid, name, email, street, municipal, postalCode, vat);

            }
            else{
                // Invalid XML
                sendError(channel, "XML to patch user could not be validated");
            }




            break;
        case "add_invoice":
            console.log("Adding a new invoice");
            // Validation
            if(messageXML.validate(addInvoiceDoc)){
                // Valid XML

                let result = JSON.parse(xmlParser.toJson(messageXML.toString()));
                console.log(" ");

                console.log(result);
                console.log(result.add_invoice);






            }
            else{
                // Invalid XML
                sendError(channel, "XML to create invoice could not be validated");
            }
            break;
        case "update_invoice":
            console.log("Updating an existing invoice");
            // Validation
            if(messageXML.validate(updateInvoiceDoc)){
                // Valid XML
            }
            else{
                // Invalid XML
                sendError(channel, "XML to update invoice could not be validated");
            }
            break;
        default:
            sendError(channel, "Unknown case");

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
            //console.log(error);
            console.log("Failure to patch IN user");
        }
    }
    catch(error){
        console.log("Error when getting app id from uuid");
        //console.log(error);
    }




}

/*function patchUserUUID(uuid, applicationId){
    let settings = {
        "url": `http://10.3.50.9/uuid-master/uuids/${uuid}`,
        "method": "PATCH",
        "timeout": 0,
        "headers": {
            "Content-Type": "application/json"
        },
        "data": JSON.stringify({"facturatie":`${applicationId}`}),
    };

    $.ajax(settings).done(function (response) {
        console.log("User should be have been patched");
        console.log(response);
    });
}*/
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
function sendError(channel, message){
    let errQueue = "errors.exchange";
    channel.assertQueue(errQueue, {
        durable:false
    });
    channel.sendToQueue(errQueue, Buffer.from(message));
    console.log(`${message} sent to ${errQueue}`);
}
