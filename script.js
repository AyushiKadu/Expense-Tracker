document.addEventListener('DOMContentLoaded', function() {
  // set date to today
  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.valueAsDate = new Date();

  // form submit
  const form = document.getElementById('expenseForm');
  if (form) form.addEventListener('submit', addExpense);

  loadExpenses();
});

let allExpenses = []; // cache of raw expenses fetched from server

/* Add expense */
function addExpense(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  fetch('add_expense.php', {
    method: 'POST',
    body: formData
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      showMessage('Expense added successfully!', 'success');
      form.reset();
      document.getElementById('date').valueAsDate = new Date();
      loadExpenses();
    } else {
      showMessage('Error: ' + (data.message || 'Unable to add expense'), 'error');
      console.error('add_expense response:', data);
    }
  })
  .catch(err => {
    console.error('Add expense fetch error:', err);
    showMessage('Failed to add expense. Check console.', 'error');
  });
}

/* Load from server */
function loadExpenses() {
  fetch('fetch_expenses.php')
    .then(r => r.text())
    .then(text => {
      try {
        const data = JSON.parse(text);
        if (data.success) {
          // keep raw expenses to filter on client
          allExpenses = data.expenses || [];
          displayExpenses(allExpenses);
          calculateTotal(allExpenses);
          // server may already return per-user totals; use it if provided
          if (data.userTotals) {
            displayUserTotals(data.userTotals);
          } else {
            calculateFilteredUserTotals(allExpenses);
          }
        } else {
          showMessage('Error loading expenses: ' + (data.message || ''), 'error');
        }
      } catch (err) {
        console.error('Invalid JSON from fetch_expenses.php:', text);
        showMessage('Failed to load expenses. Check console for details.', 'error');
      }
    })
    .catch(err => {
      console.error('Fetch error:', err);
      showMessage('Failed to load expenses from server.', 'error');
    });
}

/* Display expense rows */
function displayExpenses(expenses) {
  const tbody = document.getElementById('expensesBody');
  const noExpenses = document.getElementById('noExpenses');
  const table = document.getElementById('expensesTable');
  tbody.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    noExpenses.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  noExpenses.style.display = 'none';
  table.style.display = 'table';

  // If server returns split rows (one row per user for a single expense), we compute split display
  const countMap = {};
  expenses.forEach(exp => {
    const id = exp.expense_id;
    countMap[id] = (countMap[id] || 0) + 1;
  });

  expenses.forEach(exp => {
    const row = document.createElement('tr');

    // display amount: prefer split_amount if present, else compute
    let disp = 0;
    if (exp.split_amount !== undefined && exp.split_amount !== null && exp.split_amount !== '') {
      disp = parseFloat(exp.split_amount) || 0;
    } else {
      const parts = countMap[exp.expense_id] || 1;
      disp = (parseFloat(exp.total_amount) || 0) / parts;
    }
    if (!isFinite(disp)) disp = 0;

    row.innerHTML = `
      <td>${escapeHtml(String(exp.expense_id))}</td>
      <td>${escapeHtml(String((exp.name || '').toUpperCase()))}</td>
      <td>₹${disp.toFixed(2)}</td>
      <td>${escapeHtml(exp.category || '')}</td>
      <td>${escapeHtml(exp.user || '')}</td>
      <td>${formatDate(exp.date || '')}</td>
      <td><button class="btn-delete" onclick="deleteExpense(${exp.expense_id})">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

/* Grand total (sums each unique expense's total_amount) */
function calculateTotal(expenses) {
  const seen = new Set();
  let total = 0;
  expenses.forEach(exp => {
    const id = exp.expense_id;
    if (!seen.has(id)) {
      seen.add(id);
      total += parseFloat(exp.total_amount || 0);
    }
  });
  document.getElementById('totalAmount').textContent = `₹${total.toFixed(2)}`;
}

/* Show per-user totals (server-provided format: [{username, total_amount}, ...]) */
function displayUserTotals(userTotals) {
  const table = document.getElementById('userTotalsTable');
  const tbody = document.getElementById('userTotalsBody');
  tbody.innerHTML = '';

  if (!userTotals || userTotals.length === 0) {
    table.style.display = 'none';
    return;
  }

  table.style.display = 'table';
  userTotals.forEach(u => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(u.username)}</td><td>₹${parseFloat(u.total_amount).toFixed(2)}</td>`;
    tbody.appendChild(row);
  });
}

/* Delete */
function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;

  const fd = new FormData();
  fd.append('id', id);

  fetch('delete_expense.php', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showMessage('Expense deleted successfully!', 'success');
        loadExpenses();
      } else {
        showMessage('Error deleting: ' + (data.message || ''), 'error');
      }
    })
    .catch(err => {
      console.error('Delete error:', err);
      showMessage('Failed to delete expense.', 'error');
    });
}

/* FILTERS: show all or pair combinations */
function filterExpenses(usersStr) {
  if (usersStr === 'all') {
    displayExpenses(allExpenses);
    calculateTotal(allExpenses);
    calculateFilteredUserTotals(allExpenses);
    return;
  }

  const selected = usersStr.split(',');
  const filtered = allExpenses.filter(exp => selected.includes(exp.user));
  displayExpenses(filtered);
  calculateTotal(filtered);
  calculateFilteredUserTotals(filtered);
}

/* Compute per-user totals for any filtered dataset (client-side) */
function calculateFilteredUserTotals(expenses) {
  const totals = {};
  // when server returns split rows, use split_amount; otherwise, use total_amount for single-user expenses
  const countMap = {};
  expenses.forEach(exp => {
    countMap[exp.expense_id] = (countMap[exp.expense_id] || 0) + 1;
  });

  expenses.forEach(exp => {
    const user = exp.user || 'Unknown';
    let amt = 0;
    if (exp.split_amount !== undefined && exp.split_amount !== null && exp.split_amount !== '') {
      amt = parseFloat(exp.split_amount) || 0;
    } else {
      const parts = countMap[exp.expense_id] || 1;
      amt = (parseFloat(exp.total_amount) || 0) / parts;
    }
    totals[user] = (totals[user] || 0) + amt;
  });

  const tbody = document.getElementById('userTotalsBody');
  tbody.innerHTML = '';
  Object.entries(totals).forEach(([user, sum]) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(user)}</td><td>₹${sum.toFixed(2)}</td>`;
    tbody.appendChild(row);
  });
  document.getElementById('userTotalsTable').style.display = 'table';
}

/* Utilities */
function formatDate(dateString) {
  if (!dateString) return '';
  // ensure ISO-like parse
  const d = new Date(dateString + 'T00:00:00');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showMessage(msg, type) {
  const box = document.getElementById('messageBox');
  box.textContent = msg;
  box.className = `message-box ${type}`;
  box.style.display = 'block';
  setTimeout(() => box.style.display = 'none', 3000);
}
