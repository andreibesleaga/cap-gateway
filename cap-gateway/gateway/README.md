Api Gateway Service - Main NodeJS microservice Express HTTP(S) Server which routes all requests (register all microservices routes)

- input sanitization middleware
- middleware to validate the request against CAP XML Schema - but if necessary should be moved to coressponding responding service
- ENV variable to be set to: production, when deployed, for each microservice;
- PM2 installed as a package/global and used to run and automatically restart services on crashes - also logs to .log - check package.json starter scripts;

- servers have APPLOG_microservice.log logs when started with PM2;
- api-gateway started with PM2 (not clustered because of COTE services discovery);
- api-gateway has access-logs file in dir, if path defined with a combined Apache format logging of requests and responses times;
- constants.js - program constants settings;
