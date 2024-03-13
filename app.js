const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const fs = require("fs");

const app = express();
const port = 3000;

// Define a variable to track authentication status
let isAuthenticated = false;

// MySQL Database Connection (for Azure)
var connection = mysql.createConnection({ 
    host: "cms-azure-db.mysql.database.azure.com", 
    user: "cmsazuredb", 
    password: "Pragati4cadb", 
    database: "cms", port: 3306, 
    ssl: { 
        ca: fs.readFileSync("DigiCertGlobalRootCA.crt.pem") 
    } 
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Cookie initialization and Session middleware
app.use(cookieParser());
app.use(session({
    secret: 'cms-session-secret-key',
    saveUninitialized: false,
    resave: false
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Production Script
app.use(express.static("./client/build/"));

// Landing Page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/build/index.html');
});


// ----------------------------------------------------------------------
// -----------------------USER ROUTES HANDLED BELOW----------------------
// ----------------------------------------------------------------------


// Signup
app.get('/signup', (req, res) => {
    res.sendFile(__dirname + '/client/build/signup.html');
});

// Login
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/client/build/login.html');
});

// Dashboard
app.get('/dashboard', (req, res) => {
    if (isAuthenticated) {
        res.sendFile(__dirname + '/client/build/dashboard.html');
    } else {
        res.redirect('/');
    }
});

// Policy
app.get('/policy', (req, res) => {
    if (isAuthenticated) {
        res.sendFile(__dirname + '/client/build/policy.html');
    } else {
        res.redirect('/');
    }
});

// Claim
app.get('/claim', (req, res) => {
    if (isAuthenticated) {
        res.sendFile(__dirname + '/client/build/claim.html');
    } else {
        res.redirect('/');
    }
});

// Signup endpoint
app.post('/signup', (req, res) => {
    const { name, username, password } = req.body;

    // Check if the username already exists
    const checkUsernameQuery = 'SELECT * FROM User WHERE Username = ?';
    connection.query(checkUsernameQuery, [username], (err, results) => {
        if (err) {
            console.error('Error during signup:', err);
            res.status(500).send('Signup failed');
            return;
        }
        if (results.length > 0) {
            // Username already exists
            res.status(400).send('Username already exists');
            return;
        }

        // Username is available, proceed with signup
        const sql = 'INSERT INTO User (Name, Username, Password) VALUES (?, ?, ?)';
        connection.query(sql, [name, username, password], (err, result) => {
            if (err) {
                console.error('Error during signup:', err);
                res.status(500).send('Signup failed');
                return;
            }
            console.log('User signed up successfully');
            res.sendStatus(200);
        });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM User WHERE Username = ? AND Password = ?`;
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send('Login failed');
            return;
        }
        if (results.length === 1) {
            // Store username in session
            req.session.username = username;
            console.log('Login successful');
            isAuthenticated = true;
            console.log(req.session.username);
            res.sendStatus(200);
        } else {
            console.log('Invalid credentials');
            res.sendStatus(401);
        }
    });
});

// Dashboard endpoint
app.get('/dashboard-info', (req, res) => {
    if (isAuthenticated) {
        // Retrieve username from session
        const username = req.session.username;

        if (!username) {
            res.status(401).send('Unauthorized'); // Redirect or handle unauthorized access
            return res.redirect('/login'); // Redirect to login if username not found in session;
        }

        // Fetch user data from the database based on username
        const sql = 'SELECT Name FROM User WHERE Username = ?';
        connection.query(sql, [username], (err, results) => {
            if (err) {
                console.error('Error fetching user info:', err);
                res.status(500).send('Failed to fetch user info');
                return;
            }
            if (results.length === 1) {
                const name = results[0].Name; // Fetching the name from the query results
                const userInfo = {
                    name: name,
                    username: username,
                    loginTime: new Date()
                };
                res.json(userInfo);
            } else {
                res.status(404).send('User not found');
            }
        });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    // Destroy session on logout
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.sendStatus(500); // Send a 500 status code if an error occurs
        } else {
            delete req.session;
            isAuthenticated = false;
            res.redirect('/login');
        }
    });
});

// View Policy Table
app.get('/user-policies', (req, res) => {
    const username = req.session.username;

    // Fetch UserID from the User table based on the username
    const getUserIDQuery = 'SELECT UserID FROM User WHERE username = ?';
    connection.query(getUserIDQuery, [username], (err, results) => {
        if (err) {
            console.error('Error fetching UserID:', err);
            res.status(500).send('Failed to fetch user policies');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('User not found');
            return;
        }

        const userID = results[0].UserID;

        // Query Policy table for policies associated with the UserID
        const getUserPoliciesQuery = `
            SELECT UserID, PolicyHolder, PolicyType, PolicyNumber, AmountAssured, PremiumAmount, DATE_FORMAT(StartDate, '%Y-%m-%d') AS StartDate, DATE_FORMAT(EndDate, '%Y-%m-%d') AS EndDate
            FROM Policy
            WHERE UserID = ?`;

        connection.query(getUserPoliciesQuery, [userID], (err, policies) => {
            if (err) {
                console.error('Error fetching user policies:', err);
                res.status(500).send('Failed to fetch user policies');
                return;
            }
            res.json(policies); // Send fetched policies as JSON response
        });
    });
});

// Add Policy endpoint
app.post('/add-policy', (req, res) => {
    const username = req.session.username;
    const { policyHolder, policyType, policyNumber, amountAssured, premiumAmount, startDate, endDate } = req.body;

    // Fetch UserID from the User table based on the username
    const getUserIDQuery = 'SELECT UserID FROM User WHERE username = ?';
    connection.query(getUserIDQuery, [username], (err, results) => {
        if (err) {
            console.error('Error fetching UserID:', err);
            res.status(500).send('Failed to add policy');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('User not found');
            return;
        }

        const userID = results[0].UserID;

        // Insert policy information into the Policy table
        const insertPolicyQuery = 'INSERT INTO Policy (UserID, PolicyHolder, PolicyType, PolicyNumber, AmountAssured, PremiumAmount, StartDate, EndDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        connection.query(insertPolicyQuery, [userID, policyHolder, policyType, policyNumber, amountAssured, premiumAmount, startDate, endDate], (err, result) => {
            if (err) {
                console.error('Error adding policy:', err);
                res.status(500).send('Failed to add policy');
                return;
            }
            console.log('Policy added successfully');
            res.sendStatus(200);
        });
    });
});

// Check Claims endpoint
app.get('/check-claims/:policyNumber', (req, res) => {
    const policyNumber = req.params.policyNumber;
    // Query to count the number of pending claims for the given policy number
    const countClaimsQuery = 'SELECT COUNT(*) AS pendingClaims FROM Claim WHERE PolicyNumber = ?';
    // Execute the query
    connection.query(countClaimsQuery, [policyNumber], (err, result) => {
        if (err) {
            console.error('Error checking claims:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        // Send the count of pending claims as JSON response
        res.json({ pendingClaims: result[0].pendingClaims });
    });
});

// Delete Policy Record
app.delete('/delete-policy/:policyNumber', (req, res) => {
    const policyNumber = req.params.policyNumber;
    // Query to delete the policy record by policy number
    const sql = 'DELETE FROM Policy WHERE PolicyNumber = ?';
    // Execute the query
    connection.query(sql, [policyNumber], (err, result) => {
        if (err) {
            console.error('Error deleting policy:', err);
            return res.status(500).send('Internal server error');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('Policy not found');
        }
        return res.status(200).send('Policy deleted successfully');
    });
});

// View Claim Table
app.get('/user-claims', (req, res) => {
    const username = req.session.username;

    // Fetch UserID from the User table based on the username
    const getUserIDQuery = 'SELECT UserID FROM User WHERE username = ?';
    connection.query(getUserIDQuery, [username], (err, results) => {
        if (err) {
            console.error('Error fetching UserID:', err);
            res.status(500).send('Failed to fetch user policies');
            return;
        }
        if (results.length === 0) {
            res.status(404).send('User not found');
            return;
        }

        const userID = results[0].UserID;

        // Query Claim table for claims associated with the UserID
        const getUserClaimsQuery = `
    SELECT UserID, Claimant, PolicyNumber, ClaimType, ClaimReason, ClaimAmount, DATE_FORMAT(ClaimDate, '%Y-%m-%d') AS ClaimDate, Status, Reason
    FROM Claim
    WHERE UserID = ?`;

        connection.query(getUserClaimsQuery, [userID], (err, claims) => {
            if (err) {
                console.error('Error fetching user claims:', err);
                res.status(500).send('Failed to fetch user claims');
                return;
            }
            res.json(claims); // Send fetched policies as JSON response
        });
    });
});

// Add Claim endpoint
app.post('/add-claim', async (req, res) => {
    const username = req.session.username;
    const { claimant, policyNumber, claimType, claimReason, claimAmount, claimDate } = req.body;

    // Fetch UserID from the User table based on the username
    const getUserIDQuery = 'SELECT UserID FROM User WHERE username = ?';
    try {
        connection.query(getUserIDQuery, [username], (error, results, fields) => {
            if (error) {
                console.error('Error fetching UserID:', error);
                res.status(500).send('Failed to add claim');
                return;
            }

            if (results.length === 0) {
                res.status(404).send('User not found');
                return;
            }

            const userID = results[0].UserID;
            console.log(userID);

            // Fetch the assured amount associated with the policy number
            const getAssuredAmountQuery = 'SELECT AmountAssured FROM Policy WHERE PolicyNumber = ?';
            connection.query(getAssuredAmountQuery, [policyNumber], (error, policyResults, fields) => {
                if (error) {
                    console.error('Error fetching policy details:', error);
                    res.status(500).send('Failed to add claim');
                    return;
                }

                if (policyResults.length === 0) {
                    res.status(404).send('Policy not found');
                    return;
                }

                const amountAssured = policyResults[0].AmountAssured;
                console.log(amountAssured);

                // Validate claim amount against assured amount
                if (parseFloat(claimAmount) > parseFloat(amountAssured)) {
                    res.status(400).send('Claim amount cannot exceed the assured amount.');
                    return;
                }

                // Insert claim information into the Claim table
                const insertClaimQuery = 'INSERT INTO Claim (UserID, Claimant, PolicyNumber, ClaimType, ClaimReason, ClaimAmount, ClaimDate) VALUES (?, ?, ?, ?, ?, ?, ?)';
                connection.query(insertClaimQuery, [userID, claimant, policyNumber, claimType, claimReason, claimAmount, claimDate], (error, insertResult, fields) => {
                    if (error) {
                        console.error('Error adding claim:', error);
                        res.status(500).send('Failed to add claim');
                        return;
                    }

                    console.log('Claim added successfully');
                    res.sendStatus(200);
                });
            });
        });
    } catch (error) {
        console.error('Error adding claim:', error);
        res.status(500).send('Failed to add claim');
    }
});


// ----------------------------------------------------------------------
// ----------------------ADMIN ROUTES HANDLED BELOW----------------------
// ----------------------------------------------------------------------


// Signup-Admin
app.get('/signup-admin', (req, res) => {
    res.sendFile(__dirname + '/client/build/signup-admin.html');
});

// Login-Admin
app.get('/login-admin', (req, res) => {
    res.sendFile(__dirname + '/client/build/login-admin.html');
});

// Dashboard-Admin
app.get('/dashboard-admin', (req, res) => {
    if (isAuthenticated) {
        res.sendFile(__dirname + '/client/build/dashboard-admin.html');
    } else {
        res.redirect('/');
    }
});

// View-Claims
app.get('/view-claims', (req, res) => {
    if (isAuthenticated) {
        res.sendFile(__dirname + '/client/build/view-claims.html');
    } else {
        res.redirect('/');
    }
});

// Signup-Admin endpoint
app.post('/signup-admin', (req, res) => {
    const { name, username, password } = req.body;

    // Check if the username already exists
    const checkUsernameQuery = 'SELECT * FROM Admin WHERE Username = ?';
    connection.query(checkUsernameQuery, [username], (err, results) => {
        if (err) {
            console.error('Error during signup:', err);
            res.status(500).send('Signup failed');
            return;
        }
        if (results.length > 0) {
            // Username already exists
            res.status(400).send('Username already exists');
            return;
        }

        // Username is available, proceed with signup
        const sql = 'INSERT INTO Admin (Name, Username, Password) VALUES (?, ?, ?)';
        connection.query(sql, [name, username, password], (err, result) => {
            if (err) {
                console.error('Error during signup:', err);
                res.status(500).send('Signup failed');
                return;
            }
            console.log('User signed up successfully');
            res.sendStatus(200);
        });
    });
});

// Login-Admin endpoint
app.post('/login-admin', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM Admin WHERE Username = ? AND Password = ?`;
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            res.status(500).send('Login failed');
            return;
        }
        if (results.length === 1) {
            // Store username in session
            req.session.username = username;
            console.log('Login successful');
            isAuthenticated = true;
            console.log(req.session.username);
            res.sendStatus(200);
        } else {
            console.log('Invalid credentials');
            res.sendStatus(401);
        }
    });
});

// Dashboard-Admin endpoint
app.get('/dashboard-admin-info', (req, res) => {
    if (isAuthenticated) {
        // Retrieve username from session
        const username = req.session.username;

        if (!username) {
            res.status(401).send('Unauthorized'); // Redirect or handle unauthorized access
            return res.redirect('/login-admin'); // Redirect to login if username not found in session
        }

        // Fetch user data from the database based on username
        const sql = 'SELECT Name FROM Admin WHERE Username = ?';
        connection.query(sql, [username], (err, results) => {
            if (err) {
                console.error('Error fetching user info:', err);
                res.status(500).send('Failed to fetch user info');
                return;
            }
            if (results.length === 1) {
                const name = results[0].Name; // Fetching the name from the query results
                const userInfo = {
                    name: name,
                    username: username,
                    loginTime: new Date()
                };
                res.json(userInfo);
            } else {
                res.status(404).send('User not found');
            }
        });
    }
});

// Logout-Admin endpoint
app.post('/logout-admin', (req, res) => {
    // Destroy session on logout
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.sendStatus(500); // Send a 500 status code if an error occurs
        } else {
            delete req.session;
            isAuthenticated = false;
            res.redirect('/login-admin');
        }
    });
});

// Admin Claims Table
app.get('/admin-claims', (req, res) => {
    const query = `
    SELECT 
    c.ClaimID,
    c.CLAIMANT,
    c.CLAIMREASON,
    c.CLAIMAMOUNT,
    c.CLAIMDATE,
    c.Status,
    c.Reason,
    p.PolicyHolder,
    p.PolicyType,
    p.PolicyNumber,
    p.AmountAssured,
    p.StartDate
FROM 
    Claim AS c
INNER JOIN 
    Policy AS p ON c.POLICYNUMBER = p.PolicyNumber;`;
    connection.query(query, (error, results) => {
        if (error) {
            console.error('Error fetching claim details:', error);
            res.status(500).json({ error: 'Error fetching claim details' });
            return;
        }
        res.json(results);
    });
});

// Endpoint to update claim status
app.put('/update-claim-status/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    connection.query(
        'UPDATE Claim SET STATUS = ?, REASON = NULL WHERE CLAIMID = ?',
        [status, id],
        (error, results) => {
            if (error) {
                console.error('Error updating claim status:', error);
                res.status(500).json({ error: 'Error updating claim status' });
                return;
            }
            res.json({ message: 'Claim status updated successfully' });
        }
    );
});

// Endpoint to add reason for declining claim
app.put('/add-reason/:id', (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    connection.query(
        'UPDATE Claim SET REASON = ? WHERE CLAIMID = ?',
        [reason, id],
        (error, results) => {
            if (error) {
                console.error('Error adding reason:', error);
                res.status(500).json({ error: 'Error adding reason' });
                return;
            }
            res.json({ message: 'Reason added  successfully' });
        }
    );
});


// ----------------------------------------------------------------------
// -----------------------PORT ROUTE HANDLED BELOW-----------------------
// ----------------------------------------------------------------------


app.listen(process.env.PORT || port, () => {
    console.log(`Server running on port ${port}`);
});
