# CAP Translation Gateway
Andrei Besleaga (Nicolae) - 2024

The Common Alerting Protocol (CAP) provides an open, non-proprietary digital message format for all types of alerts and notifications. It does not address any particular application or telecommunications method. However is it possible that it may be used without a standard language that should be always available for the final user.

This is a proof of concept, work in progress, application for a distributed mesh gateway system for automated translation and adding of sections for certain data from Common Alert Protocol to universal English language and different encoding (JSON) to end result.

Application will use translation services (APIs) to translate info data submitted to English, if non existent, and add the corresponding information to the final XML result to deliver it to the final user.

Article for the reference: https://medium.com/@andrei-besleaga/innovative-usage-of-emerging-it-technologies-in-multi-hazard-early-warning-systems-7bcfe3d170b9

### Backend consists of:

1. API Gateway (REST API service) which is a NodeJs Express server for communication over HTTP(S) with clients
2. CAP Translator microservice for operations
3. Admin microservices for demo of other various facilities to be implemented

Backend uses Node COTE — A Node.js library for building zero-configuration microservices (which creates a mesh network of microservices), chosen for:
- Zero dependency: Multiple Microservices with only JavaScript and Node.js 
- Zero-configuration: no IP addresses, no ports, no routing to configure
- Decentralized: No fixed parts, no "manager" nodes, no single point of failure
- Auto-discovery: Services discover each other without a central bookkeeper
- Fault-tolerant: Don't lose any requests when a service is down
- Scalable: Horizontally scale to any number of machines
- Performant: Process thousands of messages per second
- Humanized API: simple to get started with a reasonable API

All services should be run with PM2 process manager (which also takes care of caught/uncaught exceptions and failures of runtime code and can log all for debug/dev purposes and also gives full availability to the microservice - with restart and resources management - unless deployed to a cloud appservice or similar and other managed mechanism can be used).

The cap-gateway directory requires node only for monitor.js as example of inter-microservices communications only.

## Installation
git clone https://github.com/andreibesleaga/cap-gateway

cd cap-gateway

npm install

cd responder-microservices

npm install

npm start

cd ../gateway

npm install

npm start

### For the quickest start:

Have PM2 installed globally and type: pm2 start all.json
This will run all the services you need, and you can monitor your services with pm2 monit or use any pm2 commands at your disposal.

Or cd to gateway and run once the : npm start, then cd to the responder-microservices and run as many times the microservices as necessary with : npm start

### RESTful API endpoints:

responder-microservices

cap-microservice:
POST /app/cap/translate : returns the posted XML CAP data with added english translation section (and optional result encoding JSON);
(request body params: message - original XML CAP data, exportJson - optional boolean to return just JSON encoded result instead of XML)

admin-microservice:
POST /app/admin/services/pubsub : publish messages for inter micro services communication;


All API endpoints calls to be tested with Postman, ThunderClient directly from VSCode or other REST API tools.


## Architecture considerations

Current app is implemented as a standard REST API with distributed mesh microservices (gateway plus services) and uses third party APIs for translating the language and add new english section in the result, for automated use of the protocol where needed to be available in english, without further development of existing software, by routing requests through the gateway, or where the application will use a new proposed encoding format of CAP protocol to JSON instead of XML encoding.

API gateway is the entry point which balances all the requests to services. The responder microservice can be started as many times as necessary in the mesh network so that many responders will be available and balance the requests, but also all the services and gateway can be deployed as app services in the cloud, without using the mesh inter-communicating network having the possibility to use the cloud specific APIs/Resources for the operations, as they are already managed/monitored and the needed resources increased when necessary, so that the app would be always available and performant in case of high peak usage.

A flow would be configured through a proxy, for the requests to be done on the fly, by submitting automatically the XML CAP message, while in transit, and continuing the flow with the modified resulting response of the service output, complete XML CAP message, for further routing to destination.
