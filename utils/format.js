/**
 * Format a number as PKR currency: PKR X,XXX.XX
 * @param {number} amount 
 * @returns {string}
 */
export const formatPKR = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'PKR 0.00';
  }
  return 'PKR ' + Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Format timestamp or date to readable string (e.g. "Today, 10:30 AM" or "Jun 22, 2026")
 * @param {Date|Object} dateInput - Date object or Firestore Timestamp
 * @returns {string}
 */
export const formatTxDate = (dateInput) => {
  if (!dateInput) return '';
  
  let date;
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    date = new Date(dateInput);
  } else if (dateInput.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    return '';
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeString = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return `Today, ${timeString}`;
  } else if (isYesterday) {
    return `Yesterday, ${timeString}`;
  } else {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    return `${dateStr}, ${timeString}`;
  }
};
