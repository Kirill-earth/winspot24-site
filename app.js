const defaultConfig = {
  chainName: "Ethereum Mainnet",
  tokenSymbol: "USDT",
  tokenStandard: "ERC-20",
  contractAddress: "0x0000000000000000000000000000000000000000",
  contractVersion: "mvp-macbookneo-v1",
  walletRequired: true,
  lotteryName: "MacBook Neo Drop",
  prizeName: "Новый MacBook Neo",
  totalTickets: 100,
  ticketPrice: 10,
  maxTicketsPerPurchase: 20,
};

const config = {
  ...defaultConfig,
  ...(window.WINSPOT_CONFIG || {}),
};

const storageKeys = {
  tickets: "winspot24.tickets.v2",
  history: "winspot24.history.v2",
  walletConnected: "winspot24.walletConnected.v2",
  round: "winspot24.round.v2",
};

const ui = {
  heroTitle: document.getElementById("heroTitle"),
  heroNote: document.getElementById("heroNote"),
  ticketCountInput: document.getElementById("ticketCount"),
  purchaseForm: document.getElementById("purchaseForm"),
  purchaseButton: document.getElementById("purchaseButton"),
  purchaseHint: document.getElementById("purchaseHint"),
  remainingInline: document.getElementById("remainingInline"),
  ticketPrice: document.getElementById("ticketPrice"),
  ticketCurrency: document.getElementById("ticketCurrency"),
  poolValue: document.getElementById("poolValue"),
  ticketsSold: document.getElementById("ticketsSold"),
  ticketsTotal: document.getElementById("ticketsTotal"),
  ticketsRemaining: document.getElementById("ticketsRemaining"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  roundLabel: document.getElementById("roundLabel"),
  ticketList: document.getElementById("ticketList"),
  drawButton: document.getElementById("drawButton"),
  drawResult: document.getElementById("drawResult"),
  drawRule: document.getElementById("drawRule"),
  historyList: document.getElementById("historyList"),
  chainName: document.getElementById("chainName"),
  tokenName: document.getElementById("tokenName"),
  contractAddress: document.getElementById("contractAddress"),
  walletStatus: document.getElementById("walletStatus"),
  walletButton: document.getElementById("walletButton"),
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function toShortDate(isoValue) {
  const date = new Date(isoValue);
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function randomInt(min, max) {
  const range = max - min + 1;
  const randomBuffer = new Uint32Array(1);
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    window.crypto.getRandomValues(randomBuffer);
    return min + (randomBuffer[0] % range);
  }
  return Math.floor(Math.random() * range) + min;
}

function formatTicketId(serial) {
  return `#${String(serial).padStart(3, "0")}`;
}

function normalizeTickets(rawTickets) {
  if (!Array.isArray(rawTickets)) {
    return [];
  }
  const limited = rawTickets.slice(0, config.totalTickets);
  const normalized = limited
    .map((ticket, index) => ({
      serial:
        Number.isInteger(ticket?.serial) && ticket.serial > 0
          ? ticket.serial
          : index + 1,
      createdAt: typeof ticket?.createdAt === "string" ? ticket.createdAt : new Date().toISOString(),
    }))
    .sort((a, b) => a.serial - b.serial)
    .map((ticket, index) => ({
      serial: index + 1,
      id: formatTicketId(index + 1),
      createdAt: ticket.createdAt,
    }));
  return normalized;
}

function normalizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) {
    return [];
  }
  return rawHistory
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => ({
      round: Number.isInteger(entry.round) && entry.round > 0 ? entry.round : index + 1,
      ticketId: typeof entry.ticketId === "string" ? entry.ticketId : formatTicketId(1),
      prizeName: typeof entry.prizeName === "string" ? entry.prizeName : config.prizeName,
      poolValue: Number.isFinite(Number(entry.poolValue))
        ? Number(entry.poolValue)
        : config.totalTickets * config.ticketPrice,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
    }))
    .slice(-30);
}

function normalizeRound(rawRound, history) {
  const parsed = Number(rawRound);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  if (history.length > 0) {
    return history[history.length - 1].round + 1;
  }
  return 1;
}

const state = {
  tickets: normalizeTickets(readStorage(storageKeys.tickets, [])),
  history: normalizeHistory(readStorage(storageKeys.history, [])),
  walletConnected: readStorage(storageKeys.walletConnected, false) === true,
  round: 1,
};

state.round = normalizeRound(readStorage(storageKeys.round, 1), state.history);

function soldCount() {
  return state.tickets.length;
}

function remainingTickets() {
  return Math.max(config.totalTickets - soldCount(), 0);
}

function poolValue() {
  return soldCount() * config.ticketPrice;
}

function clampPurchaseCount(value) {
  const parsed = Number.isFinite(value) ? Math.floor(value) : 1;
  const maxCount = Math.max(1, Number(config.maxTicketsPerPurchase) || 20);
  return Math.min(Math.max(parsed, 1), maxCount);
}

function createTicket(serial) {
  return {
    id: formatTicketId(serial),
    serial,
    createdAt: new Date().toISOString(),
  };
}

function persistState() {
  writeStorage(storageKeys.tickets, state.tickets);
  writeStorage(storageKeys.history, state.history);
  writeStorage(storageKeys.walletConnected, state.walletConnected);
  writeStorage(storageKeys.round, state.round);
}

function renderDrawResult(message, mode = "default") {
  ui.drawResult.className = "draw-result";
  if (mode === "win") {
    ui.drawResult.classList.add("win");
  }
  if (mode === "alert") {
    ui.drawResult.classList.add("alert");
  }
  ui.drawResult.innerHTML = `<p>${message}</p>`;
}

function renderConfig() {
  ui.heroTitle.textContent = `Розыгрыш: ${config.prizeName}`;
  ui.heroNote.textContent = `${config.totalTickets} билетов · $${config.ticketPrice} · Приз: ${config.prizeName}`;
  ui.chainName.textContent = config.chainName;
  ui.tokenName.textContent = `${config.tokenSymbol} (${config.tokenStandard})`;
  ui.contractAddress.textContent = config.contractAddress;
}

function renderWallet() {
  ui.walletStatus.textContent = state.walletConnected ? "Connected" : "Disconnected";
  ui.walletButton.textContent = state.walletConnected ? "Wallet Connected" : "Connect Wallet";
  ui.walletButton.classList.toggle("connected", state.walletConnected);
}

function renderOverview() {
  const sold = soldCount();
  const remaining = remainingTickets();
  const progress = (sold / config.totalTickets) * 100;

  ui.ticketPrice.textContent = formatUSD(config.ticketPrice);
  ui.ticketCurrency.textContent = config.tokenSymbol;
  ui.ticketsSold.textContent = String(sold);
  ui.ticketsTotal.textContent = String(config.totalTickets);
  ui.ticketsRemaining.textContent = String(remaining);
  ui.remainingInline.textContent = String(remaining);
  ui.poolValue.textContent = formatUSD(poolValue());
  ui.progressText.textContent = `Продано ${sold} из ${config.totalTickets} билетов`;
  ui.progressFill.style.width = `${Math.min(progress, 100)}%`;
  ui.roundLabel.textContent = `Раунд #${state.round}`;
}

function renderPurchaseHint() {
  const remaining = remainingTickets();
  if (remaining === 0) {
    ui.purchaseHint.textContent = "Билеты распроданы. Запусти розыгрыш.";
    return;
  }

  const requestedCount = clampPurchaseCount(Number(ui.ticketCountInput.value));
  const effectiveCount = Math.min(requestedCount, remaining);
  ui.ticketCountInput.value = String(effectiveCount);
  ui.purchaseHint.textContent = `Итог: ${formatUSD(effectiveCount * config.ticketPrice)} ${config.tokenSymbol}`;
}

function renderTicketList() {
  if (!state.tickets.length) {
    ui.ticketList.className = "ticket-list empty";
    ui.ticketList.textContent = "Покупок пока нет.";
    return;
  }

  ui.ticketList.className = "ticket-list";
  ui.ticketList.innerHTML = state.tickets
    .slice(-12)
    .reverse()
    .map(
      (ticket) => `
      <div class="ticket-item">
        <strong>${ticket.id}</strong>
        <div>Раунд #${state.round}</div>
        <small>${toShortDate(ticket.createdAt)}</small>
      </div>
    `
    )
    .join("");
}

function renderHistory() {
  if (!state.history.length) {
    ui.historyList.className = "history-list empty";
    ui.historyList.textContent = "История пуста.";
    return;
  }

  ui.historyList.className = "history-list";
  ui.historyList.innerHTML = state.history
    .slice(-6)
    .reverse()
    .map(
      (entry) => `
      <div class="history-item">
        <strong>Раунд #${entry.round}</strong>
        <div>Победитель: ${entry.ticketId}</div>
        <div>Приз: ${entry.prizeName}</div>
        <div>Пул: ${formatUSD(entry.poolValue)} ${config.tokenSymbol}</div>
        <small>${toShortDate(entry.createdAt)}</small>
      </div>
    `
    )
    .join("");
}

function renderControls() {
  const remaining = remainingTickets();
  const soldOut = remaining === 0;

  ui.purchaseButton.disabled = soldOut;
  ui.ticketCountInput.disabled = soldOut;
  ui.drawButton.disabled = !soldOut;
  ui.drawRule.textContent = soldOut
    ? `Все ${config.totalTickets} билетов проданы. Можно запускать розыгрыш ${config.prizeName}.`
    : `Розыгрыш доступен после продажи ${config.totalTickets}/${config.totalTickets} билетов.`;
}

function renderAll() {
  renderOverview();
  renderPurchaseHint();
  renderTicketList();
  renderHistory();
  renderControls();
}

function buyTickets(event) {
  event.preventDefault();

  if (config.walletRequired && !state.walletConnected) {
    renderDrawResult("Подключи кошелек перед покупкой билетов за USDT (ERC-20).", "alert");
    return;
  }

  const remaining = remainingTickets();
  if (remaining === 0) {
    renderDrawResult("Все билеты уже проданы. Нажми «Провести розыгрыш».", "alert");
    return;
  }

  const requestedCount = clampPurchaseCount(Number(ui.ticketCountInput.value));
  const ticketCount = Math.min(requestedCount, remaining);
  const firstSerial = soldCount() + 1;

  for (let index = 0; index < ticketCount; index += 1) {
    state.tickets.push(createTicket(firstSerial + index));
  }

  persistState();
  renderAll();

  const remainingAfterPurchase = remainingTickets();
  if (remainingAfterPurchase === 0) {
    renderDrawResult(
      `Куплено ${ticketCount} билетов. Sold out: ${config.totalTickets}/${config.totalTickets}. Теперь можно запускать розыгрыш.`,
      "alert"
    );
  } else {
    renderDrawResult(
      `Куплено ${ticketCount} билетов на сумму ${formatUSD(ticketCount * config.ticketPrice)} ${config.tokenSymbol}. Осталось ${remainingAfterPurchase}.`,
      "default"
    );
  }
}

function runDraw() {
  const sold = soldCount();
  if (sold < config.totalTickets) {
    renderDrawResult(
      `Продано ${sold} из ${config.totalTickets}. Розыгрыш откроется после полного sold-out.`,
      "alert"
    );
    return;
  }

  const winnerIndex = randomInt(0, state.tickets.length - 1);
  const winnerTicket = state.tickets[winnerIndex];
  const completedRound = state.round;

  state.history.push({
    round: completedRound,
    ticketId: winnerTicket.id,
    prizeName: config.prizeName,
    poolValue: poolValue(),
    createdAt: new Date().toISOString(),
  });

  state.tickets = [];
  state.round += 1;
  persistState();
  renderAll();

  renderDrawResult(
    `Раунд #${completedRound} завершен. Победил билет ${winnerTicket.id}. Приз: ${config.prizeName}.`,
    "win"
  );
}

function toggleWallet() {
  state.walletConnected = !state.walletConnected;
  persistState();
  renderWallet();

  if (state.walletConnected) {
    renderDrawResult("Wallet подключен. Можно покупать билеты за USDT (ERC-20).", "alert");
  }
}

ui.ticketCountInput.addEventListener("input", renderPurchaseHint);
ui.purchaseForm.addEventListener("submit", buyTickets);
ui.drawButton.addEventListener("click", runDraw);
ui.walletButton.addEventListener("click", toggleWallet);

renderConfig();
renderWallet();
renderAll();
