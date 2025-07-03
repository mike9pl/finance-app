addEventListener("load", async () => {
  if ("serviceWorker" in navigator) {
    var sw = await navigator.serviceWorker.register("/service-worker.js");
    console.log("service worker registered!", sw);
    if (Notification.permission === "granted") {
      console.log('Notification permission:', Notification.permission);
      subscribe();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
        if (permission === "granted") {
          subscribe();
        }
      });
    }
    syncWithMongoDB();
  } else {
    console.error("cannot register service worker. Unsupported browser!");
  }
});
async function subscribe() {
  var sw = await navigator.serviceWorker.ready;
  var push = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey:
      "BOIl0ZJ_8UB0qY8qOUV92c8EnDjcrgEZpjSWPkgy1vCfvLQVkpBaow1tN4kvwEe2pWmaRXwN7f8IQ8hD9ylXMpo"
  });
  console.log(JSON.stringify(push));
  fetch("http://localhost:5000/subscription", {
    method: "POST",
    body: JSON.stringify(push),
    headers: {
      "Content-Type": "application/json"
    }
  })
};

const form = document.getElementById('transaction-form');
const transactionsList = document.getElementById('transactions');
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
//Synchronizacja z MongoDB
async function syncWithMongoDB() {
  try {
    const res = await fetch('http://localhost:5000/api/transactions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });  
    const data = await res.json();
    transactions = data.map(t => ({
      id: t._id,
      description: t.description,
      type: t.type,
      balance: t.balance,
      amount: t.amount,
      date: t.date
    }));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderTransactions();
  } catch (err) {
    console.warn('Nie udało się połączyć z API. Tryb offline.', err);
  }
};

let currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const description = document.getElementById('description').value;
  const amount = +document.getElementById('amount').value;
  const type = document.getElementById('type').value;
  var balance = currentBalance + (type === 'income' ? amount : -amount);

  const transaction = {
    description,
    amount,
    type,
    balance,
    date: new Date().toISOString()
  };
// Dodaj lokalnie
  transactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
// Wyślij do MongoDB
  fetch('http://localhost:5000/api/transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(transaction)
  })
    .then(res => res.json())
    .then(res => {
      if (!res.success) throw new Error('Błąd zapisu');
    })
    .catch(err => {
      console.error('Błąd zapisu do MongoDB:', err);
    });

  form.reset();
});

function renderTransactions() {
  transactionsList.innerHTML = '';
  let income = 0;
  let expenses = 0;

  transactions.forEach(tr => {
    const li = document.createElement('li');
    const date = document.createElement('p');
    const description = document.createElement('p');
    const amount = document.createElement('p');
    const balance = document.createElement('p');

    transactionsList.appendChild(li);
    date.textContent = `Data: ${new Date(tr.date).toLocaleDateString('pl-PL')}`;
    description.textContent += `\nTytuł: ${tr.description}`;
    if (tr.type === 'income') {
      income += tr.amount
      amount.textContent += `\nKwota: ${tr.amount} zł`;
    }else {
      expenses += Math.abs(tr.amount);
      li.classList.add('negative')
      amount.textContent += `\nKwota: -${Math.abs(tr.amount)} zł`;
    }
    balance.textContent += `\nAktualne saldo: ${tr.balance} zł`;
  
    li.appendChild(date);
    li.appendChild(description);
    li.appendChild(amount);
    li.appendChild(balance);  
  });
  document.getElementById('income').textContent = income;
  document.getElementById('expenses').textContent = expenses;
  document.getElementById('balance').textContent = income - expenses;

  if (document.getElementById('dashboard-section') && document.getElementById('dashboard-section').style.display !== 'none') {
    renderPieChart(income, expenses);
    renderLineChart();
  }
}

let budgetLimit = parseInt(localStorage.getItem('budget')) || 1000;
document.getElementById('current-budget').textContent = budgetLimit;
document.getElementById('budget-form').addEventListener('submit', e => {
  e.preventDefault();
  const newBudget = parseInt(document.getElementById('budget-input').value);
  if (isNaN(newBudget) || newBudget <= 0) return;
  budgetLimit = newBudget;
  localStorage.setItem('budget', budgetLimit);
  document.getElementById('current-budget').textContent = budgetLimit;
  alert('Zaktualizowano budżet: ' + budgetLimit + ' zł');
});

function showSection(sectionId) {
  const dashboard = document.getElementById('dashboard-section');
  const budgetSettings = document.getElementById('budget-section');
  const transactionForm = document.getElementById('transaction-section');
  const transactionsList = document.getElementById('history-section');

  dashboard.style.display = 'none';
  budgetSettings.style.display = 'none';
  transactionForm.style.display = 'none';
  transactionsList.style.display = 'none';

  if (sectionId === 'dashboard-section') {
    dashboard.style.display = '';
     let income = 0, expenses = 0;
    transactions.forEach(tr => {
      if (tr.type === 'income') income += tr.amount;
      else expenses += Math.abs(tr.amount);
    });
    renderPieChart(income, expenses);
    renderLineChart();
  } else if (sectionId === 'budget-section') {
    budgetSettings.style.display = '';
  } else if (sectionId === 'transaction-section') {
    transactionForm.style.display = '';
  } else if (sectionId === 'history-section') {
    transactionsList.style.display = '';
    renderTransactions();
  }
};

document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const hash = this.getAttribute('href').replace('#', '');
    showSection(hash);
    history.replaceState(null, '', '#' + hash);
  });
});
window.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  showSection(hash);
});

let pieChart; 
function renderPieChart(income, expenses) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) {
    pieChart.data.datasets[0].data = [income, expenses];
    pieChart.update();
    return;
  }
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Przychody', 'Wydatki'],
      datasets: [{
        data: [income, expenses],
        backgroundColor: ['#28a745', '#dc3545'],
        borderWidth: 1
      }]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        }
      }
    }
  });
}
let lineChart;
function renderLineChart() {
  const ctx = document.getElementById('lineChart').getContext('2d');
  // Przygotowanie danych: etykiety (daty), dane (saldo)
  const labels = transactions.map(tr =>
    new Date(tr.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })
  );
  const data = transactions.map(tr => tr.balance);
  if (lineChart) {
    lineChart.data.labels = labels;
    lineChart.data.datasets[0].data = data;
    lineChart.update();
    return;
  }
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Saldo',
        data: data,
        fill: false,
        borderColor: '#007bff',
        backgroundColor: '#007bff',
        tension: 0.2,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#007bff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Data'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Saldo (zł)'
          },
          beginAtZero: true
        }
      }
    }
  });
}

document.getElementById('banner').addEventListener('click', function() {
    window.location.href = '/';
  });