<?php
$servername = "localhost";
$username = "root";
$password = ""; // leave blank unless you have set one in phpMyAdmin
$database = "expense_tracker";
$port = 3307; // use 3307 if you changed MySQL port in XAMPP

// Create connection
$conn = new mysqli($servername, $username, $password, $database, $port);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>
