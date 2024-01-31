
// dotenv
require("dotenv").config();

// auth
const OAuth2 = require('oauth').OAuth2;
const session = require('express-session');
const crypto = require('crypto');
const axios = require('axios');

// express
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// DB connection
const db_user = process.env.DB_USER;
const db_pass = process.env.DB_PASSWORD;
const uri = `mongodb+srv://${db_user}:${db_pass}@cluster0.5xrlhqb.mongodb.net/?retryWrites=true&w=majority`;

// MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redURI = process.env.RED_URI;
const baseSite = process.env.BASE_SITE;
const authorizePath = process.env.AUTHORIZE_PATH;
const accessTokenPath = process.env.ACCESS_TOKEN_PATH;

// auth
const oauth2 = new OAuth2(
  clientId,
  clientSecret,
  baseSite,
  authorizePath,
  accessTokenPath,
  null // Custom headers, if needed
);

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: true,
}));

// Define the view engine
app.set("view engine", "ejs");
app.use(express.static("public"));


// Define a middleware to check if the user is authenticated
const is_authenticated = (req, res, next) => {
  if (req.session.accessToken) {
    return next();
  }
  res.redirect('/login');
};


async function createUser(accessToken) {
  try {
    // Use the access token to make a request to the API
    const { data } = await axios.get(`${baseSite}/v2/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    // Check if the user already exists in the database
    const collection = client.db("rhub").collection("users");
    const existingUser = await collection.findOne({ intra_id: data.id });
    if (existingUser) {
      return existingUser;
    }
    // Create a new user in the database
    let userDoc = {
      login: data.login,
      intra_id: data.id,
      usual_full_name: data.usual_full_name,
      picture: data.image.link,
    };
    const insert_result = await collection.insertOne(userDoc);
    const user = await collection.findOne({ _id: insert_result.insertedId });
    return user;
  } catch (error) {
    console.error('Error fetching data from the API:', error.message);
    return null;
  }
}

// Define a route to render the home page
app.get("/", is_authenticated, async (req, res) => {
  const user = req.session.user;
  if (user == null) {
    req.session.destroy();
    res.redirect('/login');
    return;
  }
  try {
    await client.connect();
    const collection = client.db("rhub").collection("posts");
    const posts = await collection.find({}).toArray();
    res.render("index", {
      posts: posts,
      user: user,
    });
  } catch (error) {
    res.status(500).send(JSON.stringify(error));
  } finally {
    await client.close();
  }
});

app.get("/post/new", is_authenticated, async (req, res) => {
  res.render("new_post", { user: req.session.user });
});

// Define a route to render the home page
app.get("/post/:id", is_authenticated, async (req, res) => {
  try {
    const accountUser = req.session.user;
    if (accountUser != null) {
      await client.connect();
      const posts_collection = client.db("rhub").collection("posts");
      const users_collection = client.db("rhub").collection("users");
      const post_id = new ObjectId(req.params.id);
      const post = await posts_collection.findOne({ _id: post_id });
      const user_id = new ObjectId(post.user_id);
      const user = await users_collection.findOne({ _id: user_id });
      res.render("post", {
        post: post,
        user: user,
        accountUser: accountUser,
      });
    } else {
      req.session.destroy();
      res.redirect('/login');
    }
  } catch (error) {
    res.redirect('/');
  } finally {
    await client.close();
  }
});



// login page
app.get("/login", (req, res) => {
  res.render("login", { login_path: process.env.LOGIN_PATH });
});

// login callback
app.get('/RedirectURI', async (req, res) => {
  const { code } = req.query;
  if (code == undefined) {
    res.redirect('/login');
    return;
  }
  // Exchange the code for an access token
  oauth2.getOAuthAccessToken(
    code,
    { grant_type: 'authorization_code', redirect_uri: redURI },
    async (err, accessToken, refreshToken, params) => {
      if (err) {
        return res.status(500).json({ error: 'Error getting access token', details: err });
      }
      req.session.accessToken = accessToken;
      try {
        client.connect();
        let user = await createUser(accessToken);
        req.session.user = user;
      } catch (error) {
        console.error('error:', error.message);
      } finally {
        client.close();
      }
      res.redirect('/');
    }
  );
});

app.get('/tags', is_authenticated, (req, res) => {
  res.redirect('/');
})

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
