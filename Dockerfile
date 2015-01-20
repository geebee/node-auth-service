FROM nodejs:latest

ADD package.json /tmp/package.json
RUN cd /tmp && npm install --production > /dev/null; \
    npm cache clean
RUN mkdir -p /opt/auth/log && \
    cp -a /tmp/node_modules /opt/auth/

WORKDIR /opt/auth
ADD . /opt/auth

EXPOSE 8091

CMD ["--port", "8091", "--secret", "mongoData", "--endpoint", "auth"]
ENTRYPOINT ["node", "auth.js"]
