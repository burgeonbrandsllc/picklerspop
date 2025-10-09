const graphqlEndpoint = "https://account.picklerspop.com/customer/api/graphql";

const res = await fetch(graphqlEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "Origin": "https://account.picklerspop.com",
    "Referer": "https://account.picklerspop.com/",
  },
  body: JSON.stringify({ query }),
});