import { localDay } from "./public/assets/stock.mjs";
const seed = () => ({
    nextOrder: 1045,
    products: [
      ["ST-250", "Still Water · 250ml"], ["ST-500", "Still Water · 500ml"], ["ST-1000", "Still Water · 1 litre"],
      ["GL-CL", "Classic Olive · 750ml"], ["GL-FR", "Forest Reserve · 750ml"],
      ["GL-SB", "Sapphire Blue · 750ml"], ["GL-AS", "Aqua Spring · 750ml"],
    ],
    customers: [
      { id: "c1", name: "Juniper House Hotel", type: "Hospitality", email: "orders@juniper.example", address: "10 Example Quay, London", postcode: "SE1 9GF" },
      { id: "c2", name: "Field & Finch Kitchen", type: "Hospitality", email: "kitchen@fieldfinch.example", address: "24 Example Lane, Richmond", postcode: "TW9 1DN" },
      { id: "c3", name: "Bramble Corner Store", type: "Retail", email: "stock@bramble.example", address: "6 Example Street, Guildford", postcode: "GU1 3UW" },
      { id: "c4", name: "Northlight Studio", type: "Business", email: "office@northlight.example", address: "15 Example Court, London", postcode: "EC1A 1BB" },
    ],
    assets: [
      { id: "a1", code: "VAN-01", name: "London delivery van", type: "Vehicle", status: "Available", location: "London depot", service: localDay(23), notes: "Local trade deliveries" },
      { id: "a2", code: "VAN-02", name: "Home Counties delivery van", type: "Vehicle", status: "Available", location: "London depot", service: localDay(8), notes: "" },
      { id: "a3", code: "WH-04", name: "Electric pallet truck", type: "Warehouse equipment", status: "In service", location: "London depot", service: localDay(-1), notes: "Inspection booked" },
      { id: "a4", code: "RT-01", name: "Returnable pallet set", type: "Returnable packaging", status: "In use", location: "Juniper House Hotel", service: "", notes: "Collect on next trade delivery" },
    ],
    lots: [
      ["b1", "GL-CL", "CL-2610-A", "A-01", 480, 110, false],
      ["b2", "ST-500", "ST-2610-C", "B-03", 720, 124, false],
      ["b3", "GL-SB", "SB-2610-A", "A-03", 38, 96, false],
      ["b4", "ST-250", "ST-2611-A", "B-01", 600, 150, false],
      ["b5", "GL-FR", "FR-2610-B", "A-02", 110, 18, false],
      ["b6", "GL-AS", "AS-2610-D", "Q-01", 52, 89, true],
      ["b7", "ST-1000", "ST-2610-F", "B-05", 190, 130, false],
    ].map(([id, sku, code, location, onHand, days, hold]) => ({
      id, sku, code, location, onHand, best: localDay(days), hold,
      holdReason: hold ? "Check damaged outer cases" : "", supplier: "Example Spring Bottling",
      supplierAddress: "1 Example Road, Derbyshire", received: localDay(-9), receipt: "GRN-810",
    })),
    orders: [
      ["OL-1041", "c1", "Out for delivery", "b1", 96, "a1", 0, "RUN-LDN-01"],
      ["OL-1042", "c2", "Ready to dispatch", "b2", 72, "", 1, ""],
      ["OL-1043", "c3", "Ready to dispatch", "b5", 36, "", 1, ""],
      ["OL-1044", "c4", "Delivered", "b4", 48, "a2", -2, "RUN-HC-06"],
    ].map(([id, customer, status, lot, qty, asset, days, reference]) => ({
      id, customer, status, lines: [{ lot, qty }], asset, expected: localDay(days), reference,
      created: localDay(-3), dispatched: asset ? localDay(days) : "", delivered: status === "Delivered" ? localDay(days) : "",
      proof: status === "Delivered" ? "Received at reception · DEMO-POD-04" : "", exception: "",
      recipient: {
        c1: { name: "Juniper House Hotel", address: "10 Example Quay, London", postcode: "SE1 9GF" },
        c2: { name: "Field & Finch Kitchen", address: "24 Example Lane, Richmond", postcode: "TW9 1DN" },
        c3: { name: "Bramble Corner Store", address: "6 Example Street, Guildford", postcode: "GU1 3UW" },
        c4: { name: "Northlight Studio", address: "15 Example Court, London", postcode: "EC1A 1BB" },
      }[customer],
    })),
    events: [
      { text: "OL-1041 dispatched · RUN-LDN-01", date: localDay(), page: "deliveries" },
      { text: "AS-2610-D placed on hold for packaging inspection", date: localDay(), page: "traceability" },
      { text: "OL-1044 delivered · proof recorded", date: localDay(-2), page: "deliveries" },
    ],
    movements: [
      ["b1", 576], ["b2", 720], ["b3", 38], ["b4", 648], ["b5", 110], ["b6", 52], ["b7", 190],
    ].map(([lot, qty]) => ({ lot, qty, date: localDay(-9), kind: "Receipt", reference: "GRN-810" })).concat([
      { lot: "b4", qty: -48, date: localDay(-2), kind: "Dispatch", reference: "OL-1044" },
      { lot: "b1", qty: -96, date: localDay(), kind: "Dispatch", reference: "OL-1041" },
    ]),
  });
export { seed };
