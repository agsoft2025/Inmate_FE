import api from "../lib/axios";

export const getPostCart = async ({ page, limit, search } = {}) => {
  // If your backend supports query params, keep this.
  // If not, you can remove params and just call api.get("/pos-shop-cart")
  const res = await api.get("/pos-shop-cart", {
    params: { page, limit, search },
  });

  return res.data; // keep full response { success, data, ... } if you want
  // OR return res.data?.data || [] if you want only array
};

export const reversePostCart = async ({ id }) => {
  const res = await api.post(`/pos-shop-cart/reverse/${id}`);
  return res.data;
};

export const getTuckShopItems = async () => {
  const res = await api.get(`/tuck-shop`);
  return res.data?.data || [];
};

// 3) create purchase
export const createPosShopCart = async (payload) => {
  const res = await api.post(`/pos-shop-cart/create`, payload);
  return res.data;
};