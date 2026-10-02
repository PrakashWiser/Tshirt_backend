import test from "node:test";
import assert from "node:assert/strict";
import Address from "../models/Address.js";
import { updateAddress } from "../controllers/addressController.js";

test("updateAddress ignores ownership and model-managed request fields", async () => {
  const originalFindOne = Address.findOne;
  const address = {
    user: "owner-id",
    fullName: "Original Name",
    createdAt: "original-date",
    save: async () => {},
  };
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  Address.findOne = async () => address;

  try {
    await updateAddress(
      {
        params: { id: "address-id" },
        user: { _id: "owner-id" },
        body: {
          fullName: "Updated Name",
          user: "other-user-id",
          createdAt: "changed-date",
          __v: 99,
        },
      },
      response,
    );
  } finally {
    Address.findOne = originalFindOne;
  }

  assert.equal(address.fullName, "Updated Name");
  assert.equal(address.user, "owner-id");
  assert.equal(address.createdAt, "original-date");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
});
