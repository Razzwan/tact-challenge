import "@stdlib/deploy";

/*
  TASK 3 - DEX
  Create a simple jetton dex contract that trades one pair of jettons: A and B.
  The price of jettons depends on the amount of jettons that smart contract has.
  Therefore, the smart contract needs to keep track of how much jettons it has.

  Price for the jetton A in swap B->A should be calculated by formula "amountOfJettonAOnContract * decimal / amountOfJettonBOnContract".
  Token prices must be decimalized for accuracy, so it is the prices that must be adjusted to decimal 1e9.
  Decimals are only needed for price accuracy. It should be set as 1e9.
  So, if smart contract has 10 of jetton A and 2 of jetton B, then after sending 1 jetton B you should receive 5 of jettons A.

  Example formula for amountOfAJettonToSend in B->A swap will be
  (amountOfJettonAOnContract * decimal / amountOfJettonBOnContract) * amountOfTokenBToSwap / decimal

  If smart contract pool doesn't have enough jettons to trade,
  then it should send incoming jettons back to the user. For a clearer explanation,
  let's look at the example we described above (smart contract has 10 of jetton A and 2 of jetton B).
  If user will send 3 jettons B, smart contract should reject the message (because contract does not have 3 * 5 = 15 jettons A)
  and send 3 jettons B back to the user.

  If smart contract receives a different jetton (neither A nor B) then throw an error.

  Implement a getter that returns the number of jettons in the pool and
  one more to get the price of jetton A or jetton B.
  Getters' behavior with incorrect parameter (address other than that of jetton A or B)
  is undefined (there are no such tests).

  Note:
  Admin can add jettons A and B just by sending them to the smart contract (we need to add initial supply to the pool for it to be functional).
  To be exact: any jettons (A or B) received from the admin are "added". Admin can't swap.
*/

message(0x7362d09c) TokenNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

contract Task3 with Deployable {
  owner: Address;
  a: Int;
  b: Int;
  jAddressA: Address;
  jAddressB: Address;
  decimal: Int;

  init(admin: Address, newJAddressA: Address, newJAddressB: Address) {
    self.owner = admin;
    self.jAddressA = newJAddressA;
    self.jAddressB = newJAddressB;
    self.a = 0;
    self.b = 0;
    self.decimal = 1000000000;
  }

  fun getPrice(tAddress: Address): Int {
    if (tAddress == self.jAddressA) {
        if (self.a == 0) {
            return 0;
        }
        return self.b / self.a;
    }

    if (tAddress == self.jAddressB) {
        if (self.b == 0) {
            return 0;
        }
        return self.a / self.b;
    }

    return 0;
  }

  fun sendAJettons(amount: Int, msg: TokenNotification) {
    send(SendParameters{
      to: self.jAddressA,
      value: 0,
      mode: SendRemainingValue,
      bounce: false,
      body: TokenTransfer{
        queryId: msg.queryId,
        amount: amount,
        destination: msg.from,
        responseDestination: null,
        customPayload: null,
        forwardTonAmount: 1,
        forwardPayload: msg.forwardPayload
      }.toCell()
    });
  }

  fun sendBJettons(amount: Int, msg: TokenNotification) {
    send(SendParameters{
      to: self.jAddressB,
      value: 0,
      mode: SendRemainingValue,
      bounce: false,
      body: TokenTransfer{
        queryId: msg.queryId,
        amount: amount,
        destination: msg.from,
        responseDestination: null,
        customPayload: null,
        forwardTonAmount: 1,
        forwardPayload: msg.forwardPayload
      }.toCell()
    });
  }

  receive(msg: TokenNotification) {
    let ctx: Context = context();
    let jAddress: Address = ctx.sender;

    require((jAddress == self.jAddressA) || (jAddress == self.jAddressB), "Unsupported jetton");

    if (jAddress == self.jAddressA) {
        if (msg.from == self.owner) {
          self.a = self.a + msg.amount;
        } else {
          let price: Int = self.getPrice(jAddress);

          let bAmount: Int = price * msg.amount / self.decimal;

          if ((bAmount > self.b) || (bAmount == 0)) {
            self.sendAJettons(msg.amount, msg);
          } else {
            self.a = self.a + msg.amount;
            self.b = self.b - bAmount;
            self.sendBJettons(bAmount, msg);
          }
        }
    }

    if (jAddress == self.jAddressB) {
        if (msg.from == self.owner) {
          self.b = self.b + msg.amount;
        } else {
          let price: Int = self.getPrice(jAddress);

          let aAmount: Int = price * msg.amount / self.decimal;

          if ((aAmount > self.a) || (aAmount == 0)) {
            self.sendBJettons(msg.amount, msg);
          } else {
            self.b = self.b + msg.amount;
            self.a = self.a - aAmount;
            self.sendAJettons(aAmount, msg);
          }
        }
    }
  }

  get fun price(token: Address): Int {
    return self.getPrice(token);
  }

  get fun balance(token: Address): Int {
    if (token == self.jAddressA) {
      return self.a;
    }

    if (token == self.jAddressB) {
      return self.b;
    }

    return 0;
  }
}
