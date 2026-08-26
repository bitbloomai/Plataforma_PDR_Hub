import { toast as sonner } from "sonner";

export const toast = {
  success(title, description) {
    return sonner.success(title, {
      description,
    });
  },

  error(title, description) {
    return sonner.error(title, {
      description,
    });
  },

  warning(title, description) {
    return sonner.warning(title, {
      description,
    });
  },

  info(title, description) {
    return sonner.info(title, {
      description,
    });
  },

  loading(title, description) {
    return sonner.loading(title, {
      description,
    });
  },

  dismiss(id) {
    return sonner.dismiss(id);
  },

  promise(promise, messages) {
    return sonner.promise(promise, messages);
  },
};