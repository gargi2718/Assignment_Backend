
const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const redis = require("redis");

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(
  "mongodb+srv://gargi2001ee89:HLV4GEYfwSrkeSLl@cluster0.hqin9dy.mongodb.net/?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const postSchema = new mongoose.Schema({
  postId: { type: String, unique: true },
  text: String,
});

const Post = mongoose.model("Post", postSchema);
// Simple route for the root path
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Connect to Redis
const redisClient = redis.createClient();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());

// Post Creation Endpoint
app.post("/api/v1/posts", async (req, res) => {
  try {
    const { postId, text } = req.body;
    const newPost = new Post({ postId, text });
    await newPost.save();
    res.status(201).json({ message: "Post created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Analysis Endpoint
app.get("/api/v1/posts/:id/analysis", async (req, res) => {
  try {
    const postId = req.params.id;
    const cachedResult = await getFromCache(postId);

    if (cachedResult) {
      res.json(cachedResult);
    } else {
      const post = await Post.findOne({ postId });
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const analysisResult = analyzePost(post.text);
      await setInCache(postId, analysisResult);

      res.json(analysisResult);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Helper function to get data from Redis cache
function getFromCache(key) {
  return new Promise((resolve, reject) => {
    redisClient.get(key, (error, result) => {
      if (error) reject(error);
      resolve(result ? JSON.parse(result) : null);
    });
  });
}

// Helper function to set data in Redis cache
function setInCache(key, value) {
  return new Promise((resolve, reject) => {
    redisClient.setex(key, 3600, JSON.stringify(value), (error) => {
      if (error) reject(error);
      resolve();
    });
  });
}

// Dummy analysis function
function analyzePost(text) {
  const words = text.split(/\s+/);
  const wordCount = words.length;
  const totalLength = words.reduce((acc, word) => acc + word.length, 0);
  const averageWordLength = totalLength / wordCount;

  return {
    wordCount,
    averageWordLength,
  };
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
