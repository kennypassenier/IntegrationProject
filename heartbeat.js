
let amqp = require('amqplib/callback_api');

// intern: 192.168.1.2
// extern: 10.3.50.9

amqp.connect('amqp://facturatie_user:facturatie_pwd@10.3.50.9', function(error0, connection) {
    if (error0) {
        throw error0;
    }
    connection.createChannel(function(error1, channel) {
        if (error1) {
            throw error1;
        }

        setInterval(function(){
            let queue = 'heartbeats.exchange';
            let msg = currentHeartbeat();

            channel.assertQueue(queue, {
                durable: false
            });
            channel.sendToQueue(queue, Buffer.from(msg));

            console.log(" [x] Sent %s", msg);
        }, 500);


    });
    /*setTimeout(function() {
        connection.close();
        process.exit(0);
    }, 500);*/
});


function currentHeartbeat(){
    return `<?xml version="1.0" encoding="utf-8"?>
            <heartbeat>
                <application_name>facturatie</application_name>
                <timestamp>${new Date().toISOString()}</timestamp>
            </heartbeat>`;
}