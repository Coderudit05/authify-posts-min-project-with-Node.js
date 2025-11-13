// loading environment variables
require("dotenv").config();

// importing express
const express = require("express");

// initializing express app
const app = express();

// setting the port
const port = 3000;

// Importing the user model
const userModel = require("./models/user");

// Importing the post model
const Post = require("./models/post");

// Importing cookie-parser so that we can use cookies in our app
const cookieParser = require("cookie-parser");

// set the view engine to ejs
app.set("view engine", "ejs");

// Middleware to parse JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importing cookie-parser
app.use(cookieParser());

// Importing bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Importing jsonwebtoken for creating tokens
const jwt = require("jsonwebtoken");

// Adding a default route for login
app.get("/", async (req, res) => {
  res.redirect("/login");
});

// Create a new user route
app.get("/register", async (req, res) => {
  res.render("index");
});

// Registering the user

app.post("/register", async (req, res) => {
  try {
    const { name, userName, email, age, password } = req.body;

    // First check if the user already exists
    const isAlreadyRegistered = await userModel.findOne({ email: email });

    // If already registered, send a response otherwise create a new user

    if (isAlreadyRegistered) {
      return res.status(400).send("User already registered");
    }

    // Hashed the password before saving it to the database

    const saltRounds = 10; // Here I  want to set the number of salt rounds to 10

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Creating the new user with hashed password
    const newUser = await userModel.create({
      name,
      userName,
      email,
      age,
      password: hashedPassword,
    });

    // Generating JWT token for the user

    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // optional expiry
    );

    // storing the token in cookies
    res.cookie("token", token, {
      httpOnly: true, // prevents access from JS
      secure: false, // set to true in production with HTTPS
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // Redirecting to dashboard after successful registration since user is logged in
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Now we will create the login route

app.get("/login", async (req, res) => {
  res.render("login");
});

// Now we will create the login post route

app.post("/login", async (req, res) => {
  try {
    // Extracting email and password from the request body
    const { email, password } = req.body;

    // Check if the user exists
    const isUserRegistered = await userModel.findOne({ email: email });

    // If user is not registered, send a response
    if (!isUserRegistered) {
      return res.status(400).send("User not registered");
    }

    // If user is registered, compare the password

    const isPasswordCorrect = await bcrypt.compare(
      password,
      isUserRegistered.password
    ); // isUserRegistered.password is the hashed password stored in the database

    // If password is incorrect, send a response
    if (!isPasswordCorrect) {
      return res.status(401).send("Invalid password. Try again!");
    }

    // If password is correct, generate a JWT token for the user

    const token = jwt.sign(
      { userId: isUserRegistered._id, email: isUserRegistered.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Storing the token in cookies

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // Sending response

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info
    next();
  } catch (err) {
    return res.status(401).send("Invalid or expired token.");
  }
}

// Protected route for dashboard access only if logged in
app.get("/dashboard", isLoggedIn, async (req, res) => {
  try {
    // Fetch the full user object
    const user = await userModel.findById(req.user.userId);
    // Find the posts of the logged in user from the database
    const userPosts = await Post.find({ user: req.user.userId })
      .populate("user")
      .sort({ date: -1 }) // sorting posts by the latest  date first
      .lean(); // converting mongoose documents to plain JS objects

    res.render("dashboard", { posts: userPosts, user }); // passing the posts and full user to the dashboard view
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Logout route to clear the cookie
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// ********************    Creating Post Route From Here **************************************************************************

// Create the new Post route (Protected Route)
app.post("/post", isLoggedIn, async (req, res) => {
  try {
    const { thought } = req.body; // Our form field is named 'thought'

    // Validate that the post content is not empty or just whitespace
    if (!thought || thought.trim().length === 0) {
      // Option A: redirect back with query message
      return res.status(400).send("Post content cannot be empty.");
    }

    // Create a new Post and save it to the database
    const post = await Post.create({
      // Sabse pahale ye batao ki ye post krne bale ke user id kya hai toh usko ham postSchema me user field me daal denge taki pata chal jaye ki ye post kisne kiya hai
      user: req.user.userId, // from the JWT token that means logged in user
      // Now we will add the content of the post
      content: thought.trim(), // trimming any extra spaces
    });

    // After creating the post, redirect to dashboard or send a success response
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// ********************  Toggle Like / Unlike **************************************************************************

app.post("/post/:id/like", isLoggedIn, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.userId;

    // 1) Try to atomically add userId if not already present
    const alreadyLiked = await Post.exists({ _id: postId, likes: userId });

    if (alreadyLiked) {
      // remove the like (atomic)
      await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } });
    } else {
      // add the like (atomic, prevents duplicates)
      await Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } });
    }

    // Redirect back (works when referer exists); fallback to dashboard
    const referer = req.get("Referrer") || "/dashboard";
    return res.redirect(referer);
  } catch (err) {
    console.error("Like toggle error (atomic):", err);
    return res.status(500).send("Internal Server Error");
  }
});

// ******************** Show Edit Form Get Request (Owner only) **************************************************************************

app.get("/post/:id/edit", isLoggedIn, async (req, res) => {
  try {
    // Yaha sabse pahale hame post ko uske id se dhundhna padega
    const post = await Post.findById(req.params.id)
      .lean()
      .populate("user", "name userName");

    // Ab agar post nahi mila toh 404 bhej do matlab not found the post
    if (!post) return res.status(404).send("Post not found");

    // Authorization: only author can edit
    // Matlab jo post banaya hai usi user ko edit karne do
    if (post.user._id.toString() !== req.user.userId) {
      return res.status(403).send("Forbidden: you cannot edit this post");
    }

    // Ab post mil gaya hai aur authorization bhi ho gaya hai toh ab hame edit form render kar dena chahiye
    res.render("edit-post", { post, userId: req.user.userId });
  } catch (err) {
    console.error("Show edit form error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ******************** Show Edit Form Post Request (Owner only) **************************************************************************

// Ab hamne using app.get("/post/:id/edit"...) se ye toh veryfy kar liya ki user authorized hai toh ab ham uske baad post request banayenge jisme wo apne post ko edit kar sakega

app.post("/post/:id/edit", isLoggedIn, async (req, res) => {
  try {
    //
    const { content } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send("Post not found");

    // Authorization: only author can update
    if (post.user.toString() !== req.user.userId) {
      return res.status(403).send("Forbidden: you cannot edit this post");
    }

    if (!content || content.trim() === "") {
      return res.status(400).send("Content cannot be empty");
    }

    // yaha par hamne content mai agar white spaces hai toh unko trim kar diya hai aur fir uske baad post ko save kar diya hai to our database
    post.content = content.trim();
    await post.save();

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Edit post error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// ******************** Delete Post (Owner only) **************************************************************************

app.post("/post/:id/delete", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send("Post not found");

    if (post.user.toString() !== req.user.userId) {
      return res.status(403).send("Forbidden: you cannot delete this post");
    }

    await Post.findByIdAndDelete(req.params.id);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Starting the server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
