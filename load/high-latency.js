import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 30 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.20"],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/checkout`);

  check(response, {
    "checkout responded": (res) => res.status === 200 || res.status === 503,
  });

  sleep(0.2);
}
