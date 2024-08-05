Micro Services - operations on CAP translations microservices;

can be started multiple times to add more microservices availability/scalability to queries (creates more balanced/distributed service responders)

- .env constants to be set for each microservice when app deployed - copy from sample.env and change;
- NODE_ENV variable to be set to: production, when deployed, for each microservice;
- pm2 installed as a package and used to run and automatically restart services on crashes - also logs
