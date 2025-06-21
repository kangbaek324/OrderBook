import { Logger, UseGuards } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { WsGuard } from './ws.guard';
import { CustomSocket } from './interfaces/custom-socket.interface';

const accountMap = new Map<string, string>(); // userId : accountNumber

@UseGuards(WsGuard)
@WebSocketGateway(3003, {
  namespace : "stock",
  cors : { origin: '*' }
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @WebSocketServer() server: Server
  private logger: Logger = new Logger("websocketGateway");


  afterInit(server: Server) {
    this.logger.log("Websocket server reset");
  }

  handleConnection(client: CustomSocket) {
    this.logger.log(`Client Connected : ${client.id}`);
  }
  
  handleDisconnect(client: CustomSocket) {
    this.logger.log(`client Disconnected : ${client.id}`);
    if (client.user) {
      accountMap.delete(client.user.userId);
    }
  }
  
  @SubscribeMessage("joinStockRoom")
  handleJoinStockRoom(@MessageBody() stockId: number, @ConnectedSocket() client: CustomSocket) {
    const stockIdToString = stockId.toString();
    client.join("stockId_" + stockIdToString);
    this.stockUpdate(stockId);
  }

  /**
   * 사용자 접속
   * => jwt 토큰 인증
   * ------------------------
   * => 계좌 리스트 제공
   * => 가장 예전에 만들어진 계정을 연결 시킴 
   */


  @SubscribeMessage("joinAccountRoom")
  async handleJoinAccountRoom(@ConnectedSocket() client: CustomSocket, @MessageBody() accountNumber?: number) {
    const userId = client.user.userId;
    
    // 다른 곳으로 바꿀때
    if (accountMap.get(userId)) {
      if (!accountNumber) {
        client.emit('error_custom', { message: "인자 값이 누락되었습니다" });
        client.disconnect();
        return false;
      }

      const account = await this.prisma.accounts.findUnique({
        where : { account_number: accountNumber }
      });
  
      if (!account) {
        client.emit('error_custom', { message: "존재하지 않는 계좌입니다" });
        client.disconnect();
        return false;
      }

      if (account.user_id == userId) {
        client.leave("accountId_" + accountMap.get(userId));
        client.join("accountId_" + (account.id).toString());
      }
      else {
        client.emit('error_custom', { message: "접근 권한이 없습니다" });
        client.disconnect();
        return false;
      }
    }
    else {
      // 최초 연결시 가장 처음 생성한 계좌를 기본계좌로 세팅
      const basicAccount = await this.prisma.accounts.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: "asc" }
      });

      accountMap.set(userId, (basicAccount.id).toString());
      client.join("accountId_" + (basicAccount.id).toString());
      this.accountUpdate(basicAccount.id);
    }
  }

  public async stockUpdate(stockId: number) {
    const stockIdToString = stockId.toString();
    let data = {};

    const stockInfo = await this.prisma.stocks.findUnique({
      where : {
        id : stockId
      },
      select : {
        name : true,
        price : true
      }
    });
    const buyorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "buy" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price DESC
      LIMIT 10
    `
    const sellorderbookData = await this.prisma.$queryRaw
    `
      SELECT trading_type, price, SUM(number - match_number) AS number
      FROM \`order\` o
      WHERE stock_id = ${stockId} AND trading_type = "sell" AND status = "n" 
      GROUP BY trading_type, price
      ORDER BY price ASC
      LIMIT 10
    `
    const match = await this.prisma.$queryRaw
    `
      select (select price from \`order\` o where o.id = om.initial_order_id) as price, number, (select trading_type from \`order\` o where o.id = om.order_id) as type
      from order_match om where stock_id = ${stockId}
      order by matched_at desc limit 20;
    `
    data = {
      stockInfo : stockInfo,
      buyorderbookData : buyorderbookData,
      sellorderbookData : sellorderbookData,
      match : match
    }
    this.server.to("stockId_" + stockIdToString).emit("stockUpdated", data);
  }

  public async accountUpdate(accountId: number) {
    const account = await this.prisma.user_stocks.findMany({
      where: { account_id: accountId },
      select: {
        stock_id: true,
        number: true,
        can_number: true,
        average: true,
        total_buy_amount: true,
        stocks: {
          select: {
            name: true,
          },
        },
      },
    });
    
    let data;
    let dataArray = [];
    
    for(let i = 0; i < account.length; i++) {
      const price = await this.prisma.stocks.findUnique({
        where: { id: account[i].stock_id },
        select: { price: true }
      });
      data = {
        name: account[i].stocks.name,
        nowPrice: price.price,
        amount: account[i].number,
        canAmount: account[i].can_number,
        average: account[i].average,
        totalBuyAmount: (account[i].total_buy_amount).toString()
      }
      dataArray.push(data);
    } 
    
    this.server.to("accountId_" + accountId).emit("accountUpdated", dataArray)
  }

  public async orderStatus() {

  }
}

