import Account from "../components/Account";
import OrderBook from "../components/orderbook";
import OrderComplete from "../components/orderCompleteHistory";
import OrderHistory from "../components/OrderHistory";
import StockList from "../components/stockList";
import './stock.css';

const Stock = () => {
  const mySelect = 1;

  return (
    <div className="super-main">
      <div className="search_bar">{/* 검색 바 */}</div>
      <main>
        <div className="header"></div>
        <div className="main">
          <div className="stock_info">
            <StockList></StockList>
            <OrderBook></OrderBook>
          </div>
          <div className="my_info">
            <div className="my">
              <Account></Account>
              {/* <OrderComplete></OrderComplete>
                <OrderHistory></OrderHistory> */}
            </div>
            <div className="order">
              <OrderBook></OrderBook>
              <OrderBook></OrderBook>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Stock;
