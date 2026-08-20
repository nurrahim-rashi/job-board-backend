import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

import app from "./app.js";

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});