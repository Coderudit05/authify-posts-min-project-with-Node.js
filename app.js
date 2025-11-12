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

    // Redirecting to login after successful registration 
    res.redirect("/login");
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
  if (!token) return res.status(401).send("Please log in first.");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user info
    next();
  } catch (err) {
    return res.status(401).send("Invalid or expired token.");
  }
}

// Protected route for dashboard access only if logged in
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.render("dashboard", { user: req.user });
});

// Logout route to clear the cookie
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// Starting the server
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
