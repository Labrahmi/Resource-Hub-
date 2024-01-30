const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');
const uri = "mongodb+srv://ylabrahm:3Gd05uZ0TdHpjoIv@cluster0.5xrlhqb.mongodb.net/?retryWrites=true&w=majority";
const app = express();
const port = 3000;

// Set the view engine to EJS
app.set('view engine', 'ejs');

// public srcs
app.use(express.static('public'));


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        await client.close();
    }
}

// Define a route to render the home page
app.get('/', async (req, res) => {
    try {
        await client.connect();
        const collection = client.db("rhub").collection("posts");
        const posts = await collection.find({}).toArray();
        console.log(posts);
        res.render('index', { posts: posts });
    } catch (error) {
        res.status(500).send(JSON.stringify(error));
    }
});

// Define a route to render the home page

app.get('/post/:id', async (req, res) => {
    try {
        await client.connect();
        const posts_collection = client.db("rhub").collection("posts");
        const users_collection = client.db("rhub").collection("users");
        // 
        const post_id = new ObjectId(req.params.id);
        const post = await posts_collection.findOne({ _id: post_id });
        // 
        const user_id = new ObjectId(post.user_id);
        const user = await users_collection.findOne({ _id: user_id });
        //
        console.log("post", post);
        console.log("user", user);
        res.render('post', {
            post: post,
            user: user
        });
    } catch (error) {
        console.log(error);
        res.status(500).send(JSON.stringify(error));
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
