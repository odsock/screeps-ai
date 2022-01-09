import { assert } from "chai";
import { TravelUtils } from "utils/travel-utils";

describe("calcRoomDistance", () => {
  it("should return 0 for same room", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("E17N55", "E17N55"), 0);
  });

  it("should handle single digits", () => {
    assert.isNotNaN(TravelUtils.getInstance().calcRoomGridDistance("E1N5", "E1N5"));
  });

  it("should handle two digits", () => {
    assert.isNotNaN(TravelUtils.getInstance().calcRoomGridDistance("E17N55", "E17N55"));
  });

  it("should handle adjacent room", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("E17N55", "E17N54"), 1);
  });

  it("should handle room across EW axis", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("E1N5", "W1N5"), 2);
  });

  it("should handle room across NS axis", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("W1S5", "W1N5"), 10);
  });

  it("should handle room on diagonal", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("W1N5", "W2N6"), 2);
  });

  it("should handle room on diagonal across both axis", () => {
    assert.equal(TravelUtils.getInstance().calcRoomGridDistance("W1N5", "E2S6"), 14);
  });
});
