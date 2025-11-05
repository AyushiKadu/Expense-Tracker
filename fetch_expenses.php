<?php
// Connect to database
include 'database.php';

// Set response type
header('Content-Type: application/json');



$sql = "
SELECT 
    e.expense_id, 
    e.name, 
    e.total_amount, 
    c.name AS category, 
    e.date, 
    s.user, 
    s.split_amount
FROM expenses e
LEFT JOIN expense_splits s ON e.expense_id = s.expense_id
LEFT JOIN categories c ON e.category = c.id OR e.category = c.name
ORDER BY e.expense_id ASC
";

$result = $conn->query($sql);

if (!$result) {
    echo json_encode([
        'success' => false,
        'message' => 'SQL Error: ' . $conn->error
    ]);
    exit;
}

// Collect expense rows
$expenses = [];
while ($row = $result->fetch_assoc()) {
    $expenses[] = $row;
}

// -----------------------------------------------------------
// STEP 2: Calculate total expenses per user
// -----------------------------------------------------------

$userTotals = [];

$userQuery = "
SELECT 
    s.user AS username, 
    SUM(s.split_amount) AS total_amount
FROM expense_splits s
GROUP BY s.user
";

$userResult = $conn->query($userQuery);

if ($userResult && $userResult->num_rows > 0) {
    while ($row = $userResult->fetch_assoc()) {
        $userTotals[] = $row;
    }
}

// -----------------------------------------------------------
// STEP 3: Return everything as JSON
// -----------------------------------------------------------

echo json_encode([
    'success' => true,
    'expenses' => $expenses,
    'userTotals' => $userTotals
]);

$conn->close();
?>
