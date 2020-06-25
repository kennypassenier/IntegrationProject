# IntegrationProject
RabbitMQ sender and listener for Integration Project

Het is de file syncReceiver.js die de belangrijkste informatie bevat, asyncReceiver was daar zowat de eerste iteratie van maar is eigenlijk overbodig. 

Op de VM draait phantomjs om de pdf's aan te maken die bij de emails als attachment horen. 

Als service manager werd NSSM (http://nssm.cc) gebruikt op de Windows VM's.
XAMPP is gebruikt om InvoiceNinja te hosten. 

Alle software wordt automatisch opgestart bij het starten van de VM.
