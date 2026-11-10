const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const localDay = (offset = 0) => {
  const date = new Date(londonDate.format(new Date()) + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const reserved = (state, lot) => state.orders.filter((order) => order.status === "Ready to dispatch")
    .flatMap((order) => order.lines).filter((line) => line.lot === lot.id).reduce((sum, line) => sum + line.qty, 0);
const blocked = (lot) => lot.hold || lot.best < localDay();
const available = (state, lot) => blocked(lot) ? 0 : lot.onHand - reserved(state, lot);
const event = (state, text, page) => state.events.unshift({ text, page, date: localDay() });
const cleanPostcode = (value) => value.toUpperCase().replace(/\s+/g, "");
export { localDay, reserved, blocked, available, event, cleanPostcode };
