package handler

import (
	"net/http"
	"strconv"
	"valley-server/internal/lifetrace"

	"github.com/gin-gonic/gin"
)

func GetChinaHolidayCalendar(c *gin.Context) {
	year, err := strconv.Atoi(c.Param("year"))
	if err != nil || year < 2000 || year > 2100 {
		Error(c, http.StatusBadRequest, "年份格式错误")
		return
	}

	calendar, ok := lifetrace.GetChinaHolidayCalendar(year)
	if !ok {
		Error(c, http.StatusNotFound, "节假日数据不存在")
		return
	}

	Success(c, calendar)
}
