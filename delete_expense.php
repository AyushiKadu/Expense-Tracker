<?php
include 'database.php';
header('Content-Type: application/json');

$id = isset($_POST['id']) ? intval($_POST['id']) : 0;

if ($id <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid expense ID']);
    exit;
}

$conn->begin_transaction();

try {
    // 1) Delete dependent splits
    $stmt1 = $conn->prepare("DELETE FROM expense_splits WHERE expense_id = ?");
    $stmt1->bind_param("i", $id);
    $stmt1->execute();
    $stmt1->close();

    // 2) Delete the main expense
    $stmt2 = $conn->prepare("DELETE FROM expenses WHERE expense_id = ?");
    $stmt2->bind_param("i", $id);
    $stmt2->execute();
    $stmt2->close();

    // 3) Compute next AUTO_INCREMENT for expenses
    $res = $conn->query("SELECT MAX(expense_id) AS mx FROM expenses");
    $row = $res->fetch_assoc();
    $maxExpense = isset($row['mx']) ? intval($row['mx']) : 0;
    $nextExpenseAI = $maxExpense + 1;
    if ($nextExpenseAI < 1) $nextExpenseAI = 1;

    // Apply it (use integer value, no subquery)
    $conn->query("ALTER TABLE expenses AUTO_INCREMENT = " . $nextExpenseAI);

    // 4) Compute next AUTO_INCREMENT for expense_splits (id column)
    $res2 = $conn->query("SELECT MAX(id) AS mx2 FROM expense_splits");
    $row2 = $res2->fetch_assoc();
    $maxSplit = isset($row2['mx2']) ? intval($row2['mx2']) : 0;
    $nextSplitAI = $maxSplit + 1;
    if ($nextSplitAI < 1) $nextSplitAI = 1;

    $conn->query("ALTER TABLE expense_splits AUTO_INCREMENT = " . $nextSplitAI);

    $conn->commit();

    echo json_encode(['success' => true, 'message' => 'Expense deleted and ID counters adjusted.']);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
