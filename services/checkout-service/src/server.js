const express = require("express");

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/health", (req, res) => {
  res.status(200).json({
    service: "checkout-service",
    status: "healthy",
  });
});

app.listen(port, () => {
  console.log(`checkout-service listening on port ${port}`);
});
