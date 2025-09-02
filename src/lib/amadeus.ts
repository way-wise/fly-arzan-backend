// Amadeus Auth Token
const API_KEY = process.env.AMADEUS_API_KEY!;
console.log("API_KEY", API_KEY);

export const getAmadeusToken = async () => {
  const url = "https://test.api.amadeus.com/v1/security/oauth2/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AMADEUS_API_KEY!,
    client_secret: process.env.AMADEUS_API_SECRET!,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  if (!response.ok) {
    throw new Error(`Failed to amadeus token: ${response.statusText}`);
  }

  return (await response.json()).access_token;
};
