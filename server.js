// dotenv
require("dotenv").config();

// auth
const OAuth2 = require("oauth").OAuth2;
const session = require("express-session");
const crypto = require("crypto");
const axios = require("axios");

// express
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
const cli = require("nodemon/lib/cli");
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

app.use(
  session({
    secret:
      process.env.SESSION_SECRET || crypto.randomBytes(64).toString("hex"),
    resave: false,
    saveUninitialized: true,
  })
);

// Define the view engine
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Define a middleware to check if the user is authenticated
const is_authenticated = (req, res, next) => {
  if (req.session.accessToken) {
    return next();
  }
  res.redirect("/login");
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
    console.error("Error fetching data from the API:", error.message);
    return null;
  }
}

// Define a route to render the home page
app.get("/", is_authenticated, async (req, res) => {
  const user = req.session.user;
  if (user == null) {
    req.session.destroy();
    res.redirect("/login");
    return;
  }
  try {
    await client.connect();
    const collection = client.db("rhub").collection("posts");
    // find all posts and sort them by up_users
    const posts = await collection.find({}).toArray();
    posts.sort((a, b) => {
      return b.up_users.length - a.up_users.length;
    });
    res.render("index", {
      posts: posts,
      user: user,
      resourse_type: "Top ressources", // Top ressources
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

function check_post(post) {
  if (post.title == null || post.title == "") {
    return false;
  }
  if (post.description == null || post.description == "") {
    return false;
  }
  if (post.tags == null || post.tags == "") {
    return false;
  }
  if (post.body == null || post.body == "") {
    return false;
  }
  if (post.links == null || post.links == []) {
    return false;
  }
  return true;
}

app.post("/post/new", is_authenticated, async (req, res) => {
  try {
    let posted_data = req.body;
    if (check_post(posted_data) == false) {
      res.redirect("/");
      return;
    }
    else {
      let tags = posted_data.tags.split(" ");
      let post = {
        title: posted_data.title,
        description: posted_data.description,
        tags: tags,
        body: posted_data.body,
        links: posted_data.links,
        up_users: [],
        down_users: [],
        user_id: req.session.user._id,
      }
      await client.connect();
      const collection = client.db("rhub").collection("posts");
      const result = await collection.insertOne(post);
      client.close();
      // redirect to the post
      res.redirect(`/post/${result.insertedId}`);
    }
  } catch (error) {
    res.status(500).send(JSON.stringify(error.message));
  }
});

// Define a route to render the home page
app.get("/post/:id", is_authenticated, async (req, res) => {
  try {
    const success = req.query.success;
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
        success: success,
      });
    } else {
      req.session.destroy();
      res.redirect("/login");
    }
  } catch (error) {
    res.redirect("/");
  } finally {
    await client.close();
  }
});

app.get("/post/:id/:react", is_authenticated, async (req, res) => {
  try {
    let react = req.params.react;
    if (react != "like" && react != "dislike") {
      res.redirect("/");
      return;
    }
    let post_id = new ObjectId(req.params.id);
    let user_id = new ObjectId(req.session.user._id);
    if (react == "like") {
      await client.connect();
      const collection = client.db("rhub").collection("posts");
      const result = await collection.updateOne(
        { _id: post_id, up_users: { $nin: [user_id] } },
        { $addToSet: { up_users: user_id } }
      );
      client.close();
    }
    if (react == "dislike") {
      await client.connect();
      const collection = client.db("rhub").collection("posts");
      const result = await collection.updateOne(
        { _id: post_id, down_users: { $nin: [user_id] } },
        { $addToSet: { down_users: user_id } }
      );
      client.close();
    }
    // redirect to the post with success message
    res.redirect(`/post/${req.params.id}?success=1`);
  } catch (error) {
    res.status(500).send(JSON.stringify(error.message));
  }
});

// login page
app.get("/login", (req, res) => {
  let login_path = `${baseSite}/${authorizePath}?client_id=${clientId}&redirect_uri=${redURI}&response_type=code`;
  res.render("login", { login_path: login_path });
});

// login callback
app.get("/RedirectURI", async (req, res) => {
  const { code } = req.query;
  if (code == undefined) {
    res.redirect("/login");
    return;
  }
  // Exchange the code for an access token
  oauth2.getOAuthAccessToken(
    code,
    { grant_type: "authorization_code", redirect_uri: redURI },
    async (err, accessToken, refreshToken, params) => {
      if (err) {
        return res
          .status(500)
          .json({ error: "Error getting access token", details: err });
      }
      req.session.accessToken = accessToken;
      try {
        await client.connect();
        let user = await createUser(accessToken);
        req.session.user = user;
      } catch (error) {
        console.error("error:", error.message);
      } finally {
        client.close();
      }
      res.redirect("/");
    }
  );
});

app.get("/tags", is_authenticated, (req, res) => {
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});


app.post("/search", is_authenticated, async (req, res) => {
  try {
    const user = req.session.user;
    let search = req.body;
    await client.connect();
    const collection = client.db("rhub").collection("posts");
    let project = search.project;
    let language = search.language;
    let prompt = search.prompt;
    let posts = [];
    if (project != undefined || language != undefined) {
      posts = await collection.find({
        $or: [
          { tags: { $in: [project] } },
          { tags: { $in: [language] } },
        ],
      }).toArray();
    }
    else if (project == undefined && language == undefined) {
      posts = await collection.find({
        title: { $regex: prompt, $options: "i" },
      }).toArray();
    }
    posts.sort((a, b) => {
      return b.up_users.length - a.up_users.length;
    });
    res.render("index", {
      posts: posts,
      user: user,
      resourse_type: "Search results ", // Search results
    });
  } catch (error) {
    console.log(error.message)
    res.redirect("/");
  }
});

app.get("/search", is_authenticated, (req, res) => {
  res.redirect("/");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
