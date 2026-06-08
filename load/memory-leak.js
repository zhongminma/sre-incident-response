import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3000";
const leakMb = Number(__ENV.LEAK_MB || 20);
const sleepSeconds = Number(__ENV.SLEEP_SECONDS || 2);
const iterations = Number(__ENV.ITERATIONS || 10);

export const options = {
  vus: 1,
  iterations,
};

export default function () {
  const response = http.get(`${baseUrl}/memory-leak?mb=${leakMb}`, {
    timeout: "10s",
  });

  check(response, {
    "memory leak endpoint responded": (res) => res.status === 200,
  });

  if (response.status === 200) {
    console.log(response.body);
  } else {
    console.warn(`memory leak request failed with status ${response.status}`);
  }

  sleep(sleepSeconds);
}
