##Authentication Service

###Things you can do...
####Exchange username/password for API token credentials

`POST` to this URL: `http://<docker host>:8091/auth?email=<user email>&password=<user password>`

*NOTE: DO NOT run this service on HTTP in production, the password will be visible in plain text*

- Use the following CURL command (or an equivalent) to `POST`:
        curl -v -d email=giorgio@moroder.com -d password=test http://<docker host>:8091/auth
  -  If the request succeeds, expect a response (status code `200`) that looks like this:
        {userId: "<a user ID>", signingKey: "<a request signing key>"}
  -  If the request fails (due to an invalid username/password combination, or non-existent user), expect a response (status code `401`) that looks like this:
        {status: "denied", error: "Unauthorized: <error details>"}
  -  If the request fails (due to any other reason), expect a response (status code `500`) that looks like this:
        {status: "error", error: "Unknown error has occurred with message: <error details>"}
- All other requests for different endpoints will receive a returned `404` error
- All requests that do not use a `POST` request will receive a returned `405`
