# Auth Middleware

Auth library with the middleware for the GFW microservices

## Middlewares

### koa.obtainUser()

Koa Middleware.

Check if the `user` header is present in the request. If not, the middleware throw a ForbiddenException (403). If it's present, it add the user object in `ctx.state.user`.

ctx.state.user:

```json
{
  "email": "<email>", // email of the user. If it's a application token, then this field does not exist
  "firstName": "<firstName>", // firstName of the user. If it's a application token, then this field does not exist
  "lastName": "<lastName>", // lastName of the user. If it's a application token, then this field does not exist
  "id": <id>, // id of the user or application
  "photo": "<urlPhoto>", // photo of the user. If it's a application token, then this field does not exist
  "type": "<type>", // possible values: user or application
}


```

### koa.obtainPermissions()

Obtain all permissions of the logged user and add to ctx.state.permissions.
Important! It's necessary declare the `obtainUser` middleware before this middleware.

ctx.state.permissions:

```json

[
    {
      "type": "<type>", // resource type
      "value": "<value>", // resource value
      "action": "<action>" // action
    },
    ...
]

```

### koa.checkPermissions(permissions)

Check if the logged user has at **least one** of the permissions passed as a parameter.
Important! It's necessary declare the `obtainUser` middleware before this middleware.

permission:

```

[
  {
    "type": "<type>", // resource type
    "value": "<value>", // resource value
    "action": "<action>" // action
  },
  ...
]

```

### koa.checkPermissionsWithRequestParams(permissions)

Check if the logged user has at **least one** of the permissions passed as a parameter.
The difference from `koa.checkPermissions` is that the value can be obtained from a param of the url.
Important! It's necessary declare the `obtainUser` middleware before this middleware.

permission:

```

[
  {
    "type": "<type>", // resource type
    "value": "<value>", or "valueParam": "<paramName>" // resource value
    "action": "<action>""// action
  },
  ...
]

```

## HTTP Errors

### errors.ForbiddenException - 403

Object with the info of the unauthorized error. A object of this class is throwed when the user doesn't have permission
