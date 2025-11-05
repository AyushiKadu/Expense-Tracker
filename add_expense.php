<?php
include 'database.php';
header('Content-Type: application/json');

// Collect form data
$name = isset($_POST['name']) ? trim($_POST['name']) : '';
$amount = isset($_POST['amount']) ? trim($_POST['amount']) : '';
$user = isset($_POST['user']) ? trim($_POST['user']) : '';
$category = isset($_POST['category_id']) ? trim($_POST['category_id']) : '';
$date = isset($_POST['date']) ? trim($_POST['date']) : '';

// Validate
if ($name == '' || $amount == '' || $user == '' || $category == '' || $date == '') {
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

$amount = floatval($amount);
if ($amount <= 0) {
    echo json_encode(['success' => false, 'message' => 'Amount must be greater than 0']);
    exit;
}

$conn->begin_transaction();

try {
    // Insert expense
    $stmt = $conn->prepare("INSERT INTO expenses (name, total_amount, category, date) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("sdss", $name, $amount, $category, $date);
    $stmt->execute();
    $expense_id = $stmt->insert_id;
    $stmt->close();

    // Determine users
    $users = [];

    // Case 1: All
    if (strcasecmp($user, 'All') == 0) {
        $users = ['Ayushi', 'Darshil', 'Jesal'];
    }
    // Case 2: Pairs or multiple names
    elseif (strpos($user, ',') !== false) {
        // Split the comma-separated names like "Ayushi, Darshil"
        $users = array_map('trim', explode(',', $user));
    }
    // Case 3: Single user
    else {
        $users = [$user];
    }

    // Calculate split amount
    $split_amount = round($amount / count($users), 2);

    // Insert splits
    $stmt2 = $conn->prepare("INSERT INTO expense_splits (expense_id, user, split_amount) VALUES (?, ?, ?)");
    foreach ($users as $u) {
        $stmt2->bind_param("isd", $expense_id, $u, $split_amount);
        $stmt2->execute();
    }
    $stmt2->close();

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => "Expense added and split among: " . implode(', ', $users)
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}

$conn->close();
?>
