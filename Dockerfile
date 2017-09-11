FROM node:7

WORKDIR /usr/src/app
ADD . .
RUN yarn
CMD yarn test
