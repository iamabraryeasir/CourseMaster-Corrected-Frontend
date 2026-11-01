export const saveToken = (token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user_token", token);
};

export const getToken = () => {
    return localStorage.getItem("token") || localStorage.getItem("user_token");
};

export const clearToken = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_token");
};
