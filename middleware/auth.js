// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const { TENANT_ID, CLIENT_ID } = process.env;
/**
 * TENANT_ID = your Entra ID tenant GUID (e.g. 39282642-8418-47f5-bdec-4c1dfbcf42e9)
 * CLIENT_ID = your SPA app (Application) ID (e.g. 3b7fc1c3-39e2-41aa-96ee-72f90fa4f174)
 */

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000,
});

function getKey(header, cb) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

function verifyMsalIdToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        algorithms: ["RS256"],
        audience: CLIENT_ID, // must be your SPA appId
        issuer: [
          `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
          `https://sts.windows.net/${TENANT_ID}/`,
        ],
      },
      (err, decoded) => (err ? reject(err) : resolve(decoded))
    );
  });
}

/** Express middleware: requires Authorization: Bearer <ID_TOKEN> */
async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const claims = await verifyMsalIdToken(token);
    // prefer oid (object id). fallback to sub.
    req.userClaims = {
      oid: claims.oid || claims.sub,
      name: claims.name,
      email: claims.preferred_username || claims.email || claims.upn,
      roles: claims.roles || [],
      groups: claims.groups || [],
    };
    next();
  } catch (e) {
    console.error("Auth error:", e.message);
    res.status(401).json({ error: "Invalid Microsoft token" });
  }
}

module.exports = { requireAuth };
