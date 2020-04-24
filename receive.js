"use strict"

// Todo generate invoice ninja api key on VM and switch keys
// Todo change external ip to internal ip

// Imports
const amqp = require('amqplib/callback_api');
const axios = require("axios").default;
const fs = require("fs");
const libxmljs = require("libxmljs");
//const assert = require("assert");

// Load XSD files
const addUserFile = fs.readFileSync("./XSD/addUser.xsd");
const patchUserFile = fs.readFileSync("./XSD/patchUser.xsd");
const addInvoiceFile = fs.readFileSync("./XSD/addInvoice.xsd");
const updateInvoiceFile = fs.readFileSync("./XSD/updateInvoice.xsd");

// Parse the files into xml
const addUserDoc = libxmljs.parseXml(addUserFile);
const patchUserDoc = libxmljs.parseXml(patchUserFile);
const addInvoiceDoc = libxmljs.parseXml(addInvoiceFile);
const updateInvoiceDoc = libxmljs.parseXml(updateInvoiceFile);


//10.3.50.9
// Connect to the service
amqp.connect('amqp://facturatie_user:facturatie_pwd@10.3.50.9', function(error0, connection) {
    if(error0){
        console.error(error0);
        throw error0;
    }
    // Connect to the right channel
    connection.createChannel(function(error1, channel){
        if(error1){
            console.error(error1);
        }
        // Declare the queue you want to listen to
        let queue = "facturatie.queue"

        /*channel.assertQueue(queue, {
            durable: true
        });*/

        console.log(`Waiting for messages in ${queue}. Exit with CTR+C`);

        //newINUser("c900beb2-63bb-488d-ab6d-93e8540c078b", "Erik1", "erik@a.be", "Erikstraat", "Erikstad", "1111", "1234567890");

        channel.consume(queue, function(msg) {
            console.log(" [x] Received %s", msg.content.toString());
            let allowRemovaFromQueue = true;

            try{
                let messageXML = libxmljs.parseXmlString(msg.content);
                handleCases(messageXML);
            }
            catch(e){
                console.log("Unable to parse XML");
                console.log(e);
                allowRemovaFromQueue = false;
            }



            // Error handling if needed

            // If everything went well, acknowledge the message to remove it from the queue
            if(allowRemovaFromQueue){
                //channel.ack(msg);
            }


            // Todo remove noAck below if everything is working
        }, {
            noAck: false
        });
    });
});

function handleCases(messageXML){
    // Check what kind of event is being sent
    // Which we can determine by checking the name of the root element

    switch(messageXML.root().name()){
        case "add_user":
            console.log("Adding a new user");
            // Validation
            if(messageXML.validate(addUserDoc)){
                // Valid XML
                //newINUser();
            }
            else{
                // Invalid XML
            }
            break;
        case "patch_user":
            console.log("Patching user");
            // Validation
            if(messageXML.validate(patchUserDoc)){
                // Valid XML
                //updateINUser();
            }
            else{
                // Invalid XML
            }




            break;
        case "add_invoice":
            console.log("Adding a new invoice");
            // Validation
            if(messageXML.validate(addInvoiceDoc)){
                // Valid XML
            }
            else{
                // Invalid XML
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
            }
            break;
        default:
            console.log("An error must have occured");

    }
}

function newINUser(uuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){

    console.log("Posting the following data to invoiceninja: ");
    console.log(pName, pEmail, pMunicipal, pStreet, pPostalCode, pVat);

    axios.post("http://localhost/projects/ninja/public/api/v1/clients", {
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
    }).then(function(response){
        console.log("Success, new user has been added to invoiceninja");
        console.log(response.data);
        console.log(`Application id: ${response.data.data.id}`);

        let appId = response.data.data.id;

        console.log(`Patching user with uuid: ${uuid} and appId: ${appId}`);
        patchUserUUID(uuid, appId);

    }).catch(function(error){
        console.log("Failure to add user to invoiceninja");
        console.log(error)
    });
}

function updateINUser(uuid, pName, pEmail, pStreet, pMunicipal, pPostalCode, pVat){

}

/*function patchUserUUID(uuid, applicationId){
    let settings = {
        "url": `http://10.3.50.9/uuids/${uuid}`,
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
function patchUserUUID(uuid, applicationId){
    axios.patch(`http://10.3.50.9/uuids/${uuid}`,
        {"facturatie":`${applicationId}`}
    ).then(function(response){
        console.log("Successfully patched UUID");
        console.log(response);
    }).catch(function(error){
        console.log("Failure to patch UUID");
        console.log(error)
    });
}


